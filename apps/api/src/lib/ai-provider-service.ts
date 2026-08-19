import { logger } from './logger.js';

export type AICapability = 'TEXT_GENERATION' | 'CLASSIFICATION' | 'EMBEDDING' | 'STRUCTURED_OUTPUT';

export interface AIProviderConfig {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'gemini' | 'local' | 'deterministic';
  capabilities: AICapability[];
  apiKey?: string;
  baseUrl?: string;
  modelVersion: string;
  maxTokens: number;
  timeout: number;
  isActive: boolean;
}

export interface AIInferenceRequest {
  providerId?: string;
  capability: AICapability;
  input: Record<string, unknown>;
  tenantId: string;
  userId: string;
  requestId?: string;
}

export interface AIInferenceResponse {
  providerId: string;
  modelVersion: string;
  output: Record<string, unknown>;
  confidence: number | null;
  latency: number;
  tokenUsage?: { prompt: number; completion: number; total: number };
  requestId: string;
}

interface ProviderUsageStats {
  requestCount: number;
  totalLatency: number;
  errorCount: number;
  lastRequestAt: Date | null;
}

interface DeterministicInput {
  predictionType?: string;
  connectionMargin?: number;
  riskFactors?: unknown[];
  deviation?: number;
  expectedValue?: number;
  observedValue?: number;
  [key: string]: unknown;
}

const DETERMINISTIC_PROVIDER_ID = 'deterministic';

function buildDefaultProviders(): AIProviderConfig[] {
  const providers: AIProviderConfig[] = [
    {
      id: DETERMINISTIC_PROVIDER_ID,
      name: 'Deterministic Fallback',
      type: 'deterministic',
      capabilities: ['TEXT_GENERATION', 'CLASSIFICATION', 'EMBEDDING', 'STRUCTURED_OUTPUT'],
      modelVersion: 'heuristic-v1',
      maxTokens: 4096,
      timeout: 1000,
      isActive: true,
    },
  ];

  if (process.env['OPENAI_API_KEY']) {
    providers.push({
      id: 'openai',
      name: 'OpenAI',
      type: 'openai',
      capabilities: ['TEXT_GENERATION', 'CLASSIFICATION', 'EMBEDDING', 'STRUCTURED_OUTPUT'],
      apiKey: process.env['OPENAI_API_KEY'],
      baseUrl: process.env['OPENAI_BASE_URL'] ?? 'https://api.openai.com/v1',
      modelVersion: process.env['OPENAI_MODEL'] ?? 'gpt-4o',
      maxTokens: parseInt(process.env['OPENAI_MAX_TOKENS'] ?? '4096', 10),
      timeout: parseInt(process.env['OPENAI_TIMEOUT_MS'] ?? '30000', 10),
      isActive: true,
    });
  }

  if (process.env['ANTHROPIC_API_KEY']) {
    providers.push({
      id: 'anthropic',
      name: 'Anthropic',
      type: 'anthropic',
      capabilities: ['TEXT_GENERATION', 'CLASSIFICATION', 'STRUCTURED_OUTPUT'],
      apiKey: process.env['ANTHROPIC_API_KEY'],
      baseUrl: process.env['ANTHROPIC_BASE_URL'] ?? 'https://api.anthropic.com',
      modelVersion: process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-20250514',
      maxTokens: parseInt(process.env['ANTHROPIC_MAX_TOKENS'] ?? '4096', 10),
      timeout: parseInt(process.env['ANTHROPIC_TIMEOUT_MS'] ?? '30000', 10),
      isActive: true,
    });
  }

  if (process.env['GEMINI_API_KEY']) {
    providers.push({
      id: 'gemini',
      name: 'Google Gemini',
      type: 'gemini',
      capabilities: ['TEXT_GENERATION', 'CLASSIFICATION', 'STRUCTURED_OUTPUT'],
      apiKey: process.env['GEMINI_API_KEY'],
      baseUrl: process.env['GEMINI_BASE_URL'] ?? 'https://generativelanguage.googleapis.com/v1beta',
      modelVersion: process.env['GEMINI_MODEL'] ?? 'gemini-1.5-pro',
      maxTokens: parseInt(process.env['GEMINI_MAX_TOKENS'] ?? '4096', 10),
      timeout: parseInt(process.env['GEMINI_TIMEOUT_MS'] ?? '30000', 10),
      isActive: true,
    });
  }

  return providers;
}

function deterministicInfer(request: AIInferenceRequest): Record<string, unknown> {
  const input = request.input as DeterministicInput;
  const capability = request.capability;

  if (capability === 'STRUCTURED_OUTPUT') {
    const predictionType = input['predictionType'] as string | undefined;

    if (predictionType === 'TRANSFER_FAILURE') {
      const connectionMargin = (input['connectionMargin'] as number) ?? 180;
      let probability: number;
      let riskBand: string;

      if (connectionMargin < 60) {
        probability = 0.85;
        riskBand = 'high';
      } else if (connectionMargin < 120) {
        probability = 0.5;
        riskBand = 'medium';
      } else {
        probability = 0.15;
        riskBand = 'low';
      }

      return {
        predictionType: 'TRANSFER_FAILURE',
        probability,
        riskBand,
        connectionMargin,
        explanation: `Based on connection margin of ${connectionMargin} minutes, assessed as ${riskBand} risk.`,
        provider: 'deterministic',
        mode: 'fallback',
        model: 'heuristic-v1',
      };
    }

    if (predictionType === 'RISK' || input['riskFactors']) {
      const riskFactors = (input['riskFactors'] as unknown[]) ?? [];
      const factorCount = riskFactors.length;
      let riskLevel: string;
      let score: number;

      if (factorCount >= 5) {
        riskLevel = 'CRITICAL';
        score = 0.9;
      } else if (factorCount >= 3) {
        riskLevel = 'HIGH';
        score = 0.7;
      } else if (factorCount >= 1) {
        riskLevel = 'MEDIUM';
        score = 0.4;
      } else {
        riskLevel = 'LOW';
        score = 0.1;
      }

      return {
        predictionType: 'RISK',
        riskLevel,
        score,
        factorCount,
        explanation: `Risk assessed as ${riskLevel} based on ${factorCount} risk factor(s).`,
        provider: 'deterministic',
        mode: 'fallback',
        model: 'heuristic-v1',
      };
    }

    if (predictionType === 'ANOMALY' || input['deviation'] !== undefined) {
      const deviation = (input['deviation'] as number) ?? 0;
      const expectedValue = (input['expectedValue'] as number) ?? 0;
      const observedValue = (input['observedValue'] as number) ?? 0;
      const absDeviation = Math.abs(deviation);
      let severity: string;
      let score: number;

      if (absDeviation > 50) {
        severity = 'CRITICAL';
        score = 0.95;
      } else if (absDeviation > 30) {
        severity = 'HIGH';
        score = 0.75;
      } else if (absDeviation > 10) {
        severity = 'MEDIUM';
        score = 0.5;
      } else {
        severity = 'LOW';
        score = 0.2;
      }

      return {
        predictionType: 'ANOMALY',
        severity,
        score,
        expectedValue,
        observedValue,
        deviation: absDeviation,
        explanation: `Observed value ${observedValue} deviates from expected ${expectedValue} by ${absDeviation}. Severity: ${severity}.`,
        provider: 'deterministic',
        mode: 'fallback',
        model: 'heuristic-v1',
      };
    }

    return {
      predictionType: 'UNKNOWN',
      probability: 0,
      explanation: 'Insufficient input for deterministic prediction.',
      provider: 'deterministic',
      mode: 'fallback',
      model: 'heuristic-v1',
    };
  }

  if (capability === 'CLASSIFICATION') {
    return {
      classification: 'unclassified',
      confidence: 0,
      explanation: 'Deterministic fallback: no classifier configured.',
      provider: 'deterministic',
      mode: 'fallback',
      model: 'heuristic-v1',
    };
  }

  if (capability === 'TEXT_GENERATION') {
    return {
      text: 'Deterministic fallback: no text generation provider configured.',
      provider: 'deterministic',
      mode: 'fallback',
      model: 'heuristic-v1',
    };
  }

  if (capability === 'EMBEDDING') {
    return {
      embedding: Array.from({ length: 128 }, () => 0),
      dimensions: 128,
      provider: 'deterministic',
      mode: 'fallback',
      model: 'heuristic-v1',
    };
  }

  return {
    provider: 'deterministic',
    mode: 'fallback',
    model: 'heuristic-v1',
    explanation: 'Unsupported capability for deterministic fallback.',
  };
}

export class AIProviderService {
  private providers: Map<string, AIProviderConfig> = new Map();
  private usage: Map<string, ProviderUsageStats> = new Map();

  constructor() {
    const defaults = buildDefaultProviders();
    for (const p of defaults) {
      this.providers.set(p.id, p);
      this.usage.set(p.id, {
        requestCount: 0,
        totalLatency: 0,
        errorCount: 0,
        lastRequestAt: null,
      });
    }
    logger.info({ providerCount: this.providers.size }, 'AI provider service initialized');
  }

  getProvider(id: string): AIProviderConfig | undefined {
    return this.providers.get(id);
  }

  listProviders(): AIProviderConfig[] {
    return Array.from(this.providers.values());
  }

  async infer(request: AIInferenceRequest): Promise<AIInferenceResponse> {
    const requestId = request.requestId ?? `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const startTime = Date.now();

    let providerId = request.providerId;
    if (!providerId) {
      providerId = this.selectProviderForCapability(request.capability);
    }

    let provider = this.providers.get(providerId);
    if (!provider) {
      providerId = DETERMINISTIC_PROVIDER_ID;
      provider = this.providers.get(providerId)!;
    }

    const stats = this.usage.get(providerId);
    if (stats) {
      stats.requestCount += 1;
      stats.lastRequestAt = new Date();
    }

    try {
      let output: Record<string, unknown>;
      let confidence: number | null = null;
      let tokenUsage: { prompt: number; completion: number; total: number } | undefined;

      if (provider.type === 'deterministic') {
        output = deterministicInfer(request);
        confidence = (output['probability'] as number | null) ?? (output['score'] as number | null) ?? (output['confidence'] as number | null) ?? null;
      } else {
        output = await this.callExternalProvider(provider, request);
      }

      const latency = Date.now() - startTime;
      if (stats) {
        stats.totalLatency += latency;
      }

      return {
        providerId,
        modelVersion: provider.modelVersion,
        output,
        confidence,
        latency,
        tokenUsage,
        requestId,
      };
    } catch (err) {
      const latency = Date.now() - startTime;
      if (stats) {
        stats.errorCount += 1;
        stats.totalLatency += latency;
      }

      logger.error({ err, providerId, requestId }, 'AI provider inference failed, falling back to deterministic');

      if (providerId !== DETERMINISTIC_PROVIDER_ID) {
        const fallbackOutput = deterministicInfer(request);
        const fallbackStats = this.usage.get(DETERMINISTIC_PROVIDER_ID);
        if (fallbackStats) {
          fallbackStats.requestCount += 1;
          fallbackStats.lastRequestAt = new Date();
        }

        const fallbackProvider = this.providers.get(DETERMINISTIC_PROVIDER_ID)!;
        return {
          providerId: DETERMINISTIC_PROVIDER_ID,
          modelVersion: fallbackProvider.modelVersion,
          output: {
            ...fallbackOutput,
            _fallbackReason: 'primary_provider_error',
            _originalProvider: providerId,
          },
          confidence: (fallbackOutput['probability'] as number | null) ?? (fallbackOutput['score'] as number | null) ?? null,
          latency: Date.now() - startTime,
          requestId,
        };
      }

      return {
        providerId: DETERMINISTIC_PROVIDER_ID,
        modelVersion: 'heuristic-v1',
        output: {
          error: 'All providers failed',
          provider: 'deterministic',
          mode: 'fallback',
          model: 'heuristic-v1',
        },
        confidence: null,
        latency,
        requestId,
      };
    }
  }

  health(): {
    status: string;
    providers: Array<{ id: string; name: string; type: string; isActive: boolean; stats: ProviderUsageStats }>;
    timestamp: string;
  } {
    const providerHealth = Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      isActive: p.isActive,
      stats: this.usage.get(p.id) ?? {
        requestCount: 0,
        totalLatency: 0,
        errorCount: 0,
        lastRequestAt: null,
      },
    }));

    return {
      status: 'ok',
      providers: providerHealth,
      timestamp: new Date().toISOString(),
    };
  }

  private selectProviderForCapability(capability: AICapability): string {
    for (const [id, provider] of this.providers) {
      if (provider.isActive && provider.type !== 'deterministic' && provider.capabilities.includes(capability)) {
        return id;
      }
    }
    return DETERMINISTIC_PROVIDER_ID;
  }

  private async callExternalProvider(
    provider: AIProviderConfig,
    request: AIInferenceRequest,
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), provider.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (provider.type === 'openai' && provider.apiKey) {
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
      } else if (provider.type === 'anthropic' && provider.apiKey) {
        headers['x-api-key'] = provider.apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else if (provider.type === 'gemini' && provider.apiKey) {
        const separator = provider.baseUrl?.includes('?') ? '&' : '?';
        const url = `${provider.baseUrl}/models/${provider.modelVersion}:generateContent?key=${provider.apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            contents: [{ parts: [{ text: JSON.stringify(request.input) }] }],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`Gemini API error: ${response.status}`);
        }
        const data = await response.json() as Record<string, unknown>;
        return { raw: data, provider: provider.type, model: provider.modelVersion };
      }

      let endpoint = '';
      if (provider.type === 'openai') {
        endpoint = `${provider.baseUrl}/chat/completions`;
      } else if (provider.type === 'anthropic') {
        endpoint = `${provider.baseUrl}/v1/messages`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: provider.modelVersion,
          messages: [{ role: 'user', content: JSON.stringify(request.input) }],
          max_tokens: provider.maxTokens,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`${provider.type} API error: ${response.status}`);
      }

      const data = await response.json() as Record<string, unknown>;
      return { raw: data, provider: provider.type, model: provider.modelVersion };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}

export const aiProviderService = new AIProviderService();
