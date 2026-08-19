import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('./audit-logger', () => ({ auditLog: vi.fn().mockResolvedValue(undefined) }));

vi.mock('./ai-guardrails', () => ({
  aiGuardrails: {
    validate: vi.fn().mockResolvedValue({ allowed: true, reason: undefined, warnings: [] }),
    checkProtectedFields: vi.fn().mockReturnValue({ blocked: false }),
    auditEntry: vi.fn().mockReturnValue({ timestamp: new Date(), action: 'test' }),
  },
}));

vi.mock('./ai-provider-service', () => ({
  aiProviderService: {
    generateText: vi.fn().mockResolvedValue({ text: 'fallback', model: 'deterministic', version: '1.0', provider: 'deterministic' }),
    classify: vi.fn().mockResolvedValue({ label: 'low', score: 0.5 }),
    healthCheck: vi.fn().mockResolvedValue({ healthy: true, providers: [] }),
  },
}));

vi.mock('./ai-audit-service', () => ({
  aiAuditService: {
    logPrediction: vi.fn().mockResolvedValue(undefined),
    logRiskAssessment: vi.fn().mockResolvedValue(undefined),
    logAnomalyDetection: vi.fn().mockResolvedValue(undefined),
    logRecommendation: vi.fn().mockResolvedValue(undefined),
    logGuardrailViolation: vi.fn().mockResolvedValue(undefined),
  },
}));

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@airove/db', () => ({
  db: mockDb,
  baggageStateProjections: { orgId: 'org_id', baggageId: 'baggage_id' },
  expectedEvents: { orgId: 'org_id', baggageId: 'baggage_id' },
  cases: { orgId: 'org_id', id: 'id' },
  caseSla: { orgId: 'org_id', caseId: 'case_id' },
  caseEscalations: { orgId: 'org_id', caseId: 'case_id' },
  recoveryPlans: { orgId: 'org_id', id: 'id' },
  tasks: { orgId: 'org_id', caseId: 'case_id' },
}));

import { intelligenceService } from './intelligence-service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('IntelligenceService', () => {
  describe('analyze', () => {
    it('returns full intelligence response', async () => {
      mockDb.limit.mockResolvedValue([]);
      const result = await intelligenceService.analyze({
        orgId: 'org-1',
        userId: 'user-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        operations: ['prediction', 'risk', 'anomaly', 'root_cause', 'recommendation'],
      });
      expect(result.orgId).toBe('org-1');
      expect(result.subjectType).toBe('baggage');
      expect(result.subjectId).toBe('bag-1');
      expect(result.model).toBe('deterministic');
      expect(result.version).toBe('heuristic-v1');
      expect(Array.isArray(result.predictions)).toBe(true);
      expect(Array.isArray(result.riskAssessments)).toBe(true);
      expect(Array.isArray(result.anomalies)).toBe(true);
      expect(Array.isArray(result.rootCauses)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('returns blocked response when guardrails reject', async () => {
      const { aiGuardrails } = await import('./ai-guardrails.js');
      (aiGuardrails.validate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        reason: 'Rate limit exceeded',
        warnings: [],
      });
      const result = await intelligenceService.analyze({
        orgId: 'org-1',
        userId: 'user-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        operations: ['prediction'],
      });
      expect(result.predictions).toEqual([]);
      expect(result.riskAssessments).toEqual([]);
    });

    it('runs only requested operations', async () => {
      mockDb.limit.mockResolvedValue([]);
      const result = await intelligenceService.analyze({
        orgId: 'org-1',
        userId: 'user-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        operations: ['prediction'],
      });
      expect(result.predictions.length).toBeGreaterThanOrEqual(0);
      expect(result.riskAssessments).toEqual([]);
      expect(result.anomalies).toEqual([]);
    });

    it('generates requestId', async () => {
      mockDb.limit.mockResolvedValue([]);
      const result = await intelligenceService.analyze({
        orgId: 'org-1',
        userId: 'user-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        operations: ['prediction'],
      });
      expect(result.requestId).toBeDefined();
      expect(result.requestId).toMatch(/^int_/);
    });

    it('includes warnings from guardrails', async () => {
      const { aiGuardrails } = await import('./ai-guardrails.js');
      (aiGuardrails.validate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: true,
        reason: undefined,
        warnings: ['Input contains PII'],
      });
      mockDb.limit.mockResolvedValue([]);
      const result = await intelligenceService.analyze({
        orgId: 'org-1',
        userId: 'user-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        operations: ['prediction'],
      });
      expect(result.warnings).toContain('Input contains PII');
    });
  });
});
