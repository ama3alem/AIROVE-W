import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

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
  recoveryPlans: { orgId: 'org_id', id: 'id' },
  tasks: { orgId: 'org_id', caseId: 'case_id' },
}));

import { predictionEngine } from './prediction-engine.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.limit.mockResolvedValue([]);
});

describe('PredictionEngine', () => {
  describe('analyzePrediction', () => {
    it('returns completed prediction for TRANSFER_FAILURE', async () => {
      const result = await predictionEngine.analyzePrediction({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        predictionType: 'TRANSFER_FAILURE',
      });
      expect(result.status).toBe('COMPLETED');
      expect(result.organizationId).toBe('org-1');
      expect(result.predictionType).toBe('TRANSFER_FAILURE');
      expect(result.probability).toBeGreaterThanOrEqual(0);
      expect(result.probability).toBeLessThanOrEqual(1);
    });

    it('returns completed prediction for SLA_MISS', async () => {
      const result = await predictionEngine.analyzePrediction({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        predictionType: 'SLA_MISS',
      });
      expect(result.status).toBe('COMPLETED');
      expect(result.predictionType).toBe('SLA_MISS');
    });

    it('returns completed prediction for CASE_ESCALATION', async () => {
      const result = await predictionEngine.analyzePrediction({
        orgId: 'org-1',
        subjectType: 'case',
        subjectId: 'case-1',
        predictionType: 'CASE_ESCALATION',
      });
      expect(result.status).toBe('COMPLETED');
      expect(result.predictionType).toBe('CASE_ESCALATION');
    });

    it('uses default horizon of 240 minutes', async () => {
      const result = await predictionEngine.analyzePrediction({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        predictionType: 'TRANSFER_FAILURE',
      });
      expect(result.horizon).toBe(240);
    });

    it('respects custom timeHorizonMinutes', async () => {
      const result = await predictionEngine.analyzePrediction({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        predictionType: 'TRANSFER_FAILURE',
        timeHorizonMinutes: 60,
      });
      expect(result.horizon).toBe(60);
    });

    it('sets expiresAt based on horizon', async () => {
      const result = await predictionEngine.analyzePrediction({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        predictionType: 'TRANSFER_FAILURE',
        timeHorizonMinutes: 120,
      });
      const diff = result.expiresAt.getTime() - result.generatedAt.getTime();
      expect(diff).toBe(120 * 60 * 1000);
    });

    it('generates UUID id', async () => {
      const result = await predictionEngine.analyzePrediction({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        predictionType: 'TRANSFER_FAILURE',
      });
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('returns valid confidence level', async () => {
      const result = await predictionEngine.analyzePrediction({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        predictionType: 'TRANSFER_FAILURE',
      });
      expect(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).toContain(result.confidence);
    });

    it('includes evidence array', async () => {
      const result = await predictionEngine.analyzePrediction({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        predictionType: 'TRANSFER_FAILURE',
      });
      expect(Array.isArray(result.evidence)).toBe(true);
    });
  });
});
