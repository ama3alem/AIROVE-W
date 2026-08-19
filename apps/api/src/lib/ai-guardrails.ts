import { logger } from './logger';
import { auditLog } from './audit-logger';

export interface GuardrailInput {
  tenantId: string;
  userId: string;
  operation: string;
  inputData: Record<string, unknown>;
  subjectType?: string;
  subjectId?: string;
}

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
  sanitizedInput?: Record<string, unknown>;
  warnings: string[];
}

const MAX_INPUT_SIZE_BYTES = 10 * 1024;
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const PROMPT_INJECTION_PATTERNS = [
  'ignore previous',
  'ignore above',
  'system prompt',
  'override instructions',
  'bypass',
  'disregard',
  'forget everything',
  'new instructions',
  'you are now',
  'act as',
  'pretend you are',
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;

const VALID_SUBJECT_TYPES = new Set([
  'baggage',
  'case',
  'flight',
  'journey',
  'recovery_plan',
  'recovery_execution',
  'airport',
  'organization',
  'user',
  'integration',
]);

const RATE_LIMIT_STORE: Map<string, { count: number; windowStart: number }> = new Map();

function sanitizePII(input: string): { sanitized: string; piiTypes: string[] } {
  const piiTypes: string[] = [];
  let sanitized = input;

  if (EMAIL_REGEX.test(sanitized)) {
    piiTypes.push('email');
    sanitized = sanitized.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');
    EMAIL_REGEX.lastIndex = 0;
  }

  if (PHONE_REGEX.test(sanitized)) {
    piiTypes.push('phone');
    sanitized = sanitized.replace(PHONE_REGEX, '[REDACTED_PHONE]');
    PHONE_REGEX.lastIndex = 0;
  }

  if (SSN_REGEX.test(sanitized)) {
    piiTypes.push('ssn');
    sanitized = sanitized.replace(SSN_REGEX, '[REDACTED_SSN]');
    SSN_REGEX.lastIndex = 0;
  }

  return { sanitized, piiTypes };
}

function checkRateLimit(tenantId: string): boolean {
  const now = Date.now();
  const record = RATE_LIMIT_STORE.get(tenantId);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    RATE_LIMIT_STORE.set(tenantId, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count += 1;
  return true;
}

function detectPromptInjection(text: string): string | null {
  const lower = text.toLowerCase();
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (lower.includes(pattern)) {
      return pattern;
    }
  }
  return null;
}

function serializeInputData(input: Record<string, unknown>): string {
  try {
    return JSON.stringify(input);
  } catch {
    return '';
  }
}

function sanitizeRecursive(
  obj: Record<string, unknown>,
  depth: number = 0,
): { sanitized: Record<string, unknown>; piiTypes: string[] } {
  if (depth > 10) {
    return { sanitized: obj, piiTypes: [] };
  }

  const allPiiTypes: string[] = [];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const result = sanitizePII(value);
      sanitized[key] = result.sanitized;
      allPiiTypes.push(...result.piiTypes);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = sanitizeRecursive(value as Record<string, unknown>, depth + 1);
      sanitized[key] = nested.sanitized;
      allPiiTypes.push(...nested.piiTypes);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => {
        if (typeof item === 'string') {
          const result = sanitizePII(item);
          allPiiTypes.push(...result.piiTypes);
          return result.sanitized;
        }
        if (item && typeof item === 'object') {
          const nested = sanitizeRecursive(item as Record<string, unknown>, depth + 1);
          allPiiTypes.push(...nested.piiTypes);
          return nested.sanitized;
        }
        return item;
      });
    } else {
      sanitized[key] = value;
    }
  }

  return { sanitized, piiTypes: [...new Set(allPiiTypes)] };
}

export class AIGuardrailsService {
  async validate(input: GuardrailInput): Promise<GuardrailResult> {
    const warnings: string[] = [];

    if (!input.tenantId || typeof input.tenantId !== 'string') {
      return {
        allowed: false,
        reason: 'Invalid tenant context',
        warnings: ['tenantId is required and must be a string'],
      };
    }

    if (!input.userId || typeof input.userId !== 'string') {
      return {
        allowed: false,
        reason: 'Invalid user context',
        warnings: ['userId is required and must be a string'],
      };
    }

    const serializedSize = Buffer.byteLength(serializeInputData(input.inputData), 'utf-8');
    if (serializedSize > MAX_INPUT_SIZE_BYTES) {
      return {
        allowed: false,
        reason: `Input size exceeds limit: ${serializedSize} bytes (max: ${MAX_INPUT_SIZE_BYTES})`,
        warnings: [`Input was ${serializedSize} bytes`],
      };
    }

    const inputText = serializeInputData(input.inputData);
    const injectionMatch = detectPromptInjection(inputText);
    if (injectionMatch) {
      logger.warn({ tenantId: input.tenantId, userId: input.userId, pattern: injectionMatch }, 'Prompt injection detected');
      await auditLog({
        orgId: input.tenantId,
        userId: input.userId,
        action: 'ai.guardrail.prompt_injection',
        entityType: 'guardrail',
        changes: JSON.stringify({ pattern: injectionMatch, operation: input.operation }),
      });
      return {
        allowed: false,
        reason: `Potential prompt injection detected: pattern "${injectionMatch}"`,
        warnings: [`Blocked prompt injection pattern: ${injectionMatch}`],
      };
    }

    const { sanitized: sanitizedInput, piiTypes } = sanitizeRecursive(input.inputData);
    if (piiTypes.length > 0) {
      warnings.push(`PII detected and redacted: ${piiTypes.join(', ')}`);
    }

    if (input.subjectType && !VALID_SUBJECT_TYPES.has(input.subjectType)) {
      warnings.push(`Unknown subjectType: "${input.subjectType}"`);
    }

    if (input.subjectType && input.subjectId) {
      if (typeof input.subjectId !== 'string' || input.subjectId.length === 0) {
        return {
          allowed: false,
          reason: 'Invalid subjectId: must be a non-empty string',
          warnings,
        };
      }
    }

    if (!checkRateLimit(input.tenantId)) {
      logger.warn({ tenantId: input.tenantId }, 'Rate limit exceeded for AI operations');
      await auditLog({
        orgId: input.tenantId,
        userId: input.userId,
        action: 'ai.guardrail.rate_limit',
        entityType: 'guardrail',
        changes: JSON.stringify({ operation: input.operation, limit: RATE_LIMIT_MAX, window: '1m' }),
      });
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${RATE_LIMIT_MAX} requests per minute`,
        warnings: ['Tenant has exceeded the per-minute rate limit for AI operations'],
      };
    }

    if (!input.operation || typeof input.operation !== 'string') {
      return {
        allowed: false,
        reason: 'Operation is required',
        warnings,
      };
    }

    if (warnings.length > 0) {
      logger.info({ tenantId: input.tenantId, operation: input.operation, warnings }, 'Guardrail warnings');
    }

    return {
      allowed: true,
      sanitizedInput,
      warnings,
    };
  }
}

export const aiGuardrails = new AIGuardrailsService();
