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
  cases: { orgId: 'org_id', id: 'id' },
  caseSla: { orgId: 'org_id', caseId: 'case_id' },
  caseEscalations: { orgId: 'org_id', caseId: 'case_id' },
  recoveryPlans: { orgId: 'org_id', id: 'id' },
  expectedEvents: { orgId: 'org_id', baggageId: 'baggage_id' },
  tasks: { orgId: 'org_id', caseId: 'case_id' },
}));

import { riskIntelligenceService } from './risk-intelligence-service';

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.limit.mockResolvedValue([]);
});

describe('RiskIntelligenceService', () => {
  describe('assessRisk', () => {
    it('returns completed risk assessment for baggage', async () => {
      const result = await riskIntelligenceService.assessRisk({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
      });
      expect(result.status).toBe('COMPLETED');
      expect(result.organizationId).toBe('org-1');
      expect(result.subjectType).toBe('baggage');
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(result.riskLevel);
    });

    it('returns completed risk assessment for case', async () => {
      const result = await riskIntelligenceService.assessRisk({
        orgId: 'org-1',
        subjectType: 'case',
        subjectId: 'case-1',
      });
      expect(result.status).toBe('COMPLETED');
      expect(result.subjectType).toBe('case');
    });

    it('returns completed risk assessment for recovery_plan', async () => {
      const result = await riskIntelligenceService.assessRisk({
        orgId: 'org-1',
        subjectType: 'recovery_plan',
        subjectId: 'rp-1',
      });
      expect(result.status).toBe('COMPLETED');
      expect(result.subjectType).toBe('recovery_plan');
    });

    it('returns completed risk assessment for airport', async () => {
      const result = await riskIntelligenceService.assessRisk({
        orgId: 'org-1',
        subjectType: 'airport',
        subjectId: 'JFK',
      });
      expect(result.status).toBe('COMPLETED');
      expect(result.subjectType).toBe('airport');
    });

    it('includes factors array', async () => {
      const result = await riskIntelligenceService.assessRisk({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
      });
      expect(Array.isArray(result.factors)).toBe(true);
    });

    it('includes evidence array', async () => {
      const result = await riskIntelligenceService.assessRisk({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
      });
      expect(Array.isArray(result.evidence)).toBe(true);
    });

    it('returns valid confidence level', async () => {
      const result = await riskIntelligenceService.assessRisk({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
      });
      expect(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).toContain(result.confidence);
    });

    it('sets generatedAt', async () => {
      const before = Date.now();
      const result = await riskIntelligenceService.assessRisk({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
      });
      expect(result.generatedAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('generates UUID id', async () => {
      const result = await riskIntelligenceService.assessRisk({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
      });
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});
