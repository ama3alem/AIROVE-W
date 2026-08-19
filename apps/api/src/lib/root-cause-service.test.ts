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
  caseEscalations: { orgId: 'org_id', caseId: 'case_id' },
  recoveryPlans: { orgId: 'org_id', id: 'id' },
  tasks: { orgId: 'org_id', caseId: 'case_id' },
}));

import { rootCauseService } from './root-cause-service';

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.limit.mockResolvedValue([]);
});

describe('RootCauseService', () => {
  describe('analyze', () => {
    it('returns completed result for baggage with no data', async () => {
      const result = await rootCauseService.analyze({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
      });
      expect(result.status).toBe('COMPLETED');
      expect(result.organizationId).toBe('org-1');
      expect(result.subjectType).toBe('baggage');
      expect(result.subjectId).toBe('bag-1');
      expect(result.model).toBe('deterministic');
      expect(result.candidates).toEqual([]);
      expect(result.confidence).toBe('VERY_LOW');
    });

    it('returns completed result for case subject', async () => {
      const result = await rootCauseService.analyze({
        orgId: 'org-1',
        subjectType: 'case',
        subjectId: 'case-1',
      });
      expect(result.status).toBe('COMPLETED');
      expect(result.subjectType).toBe('case');
    });

    it('returns completed result for recovery_plan subject', async () => {
      const result = await rootCauseService.analyze({
        orgId: 'org-1',
        subjectType: 'recovery_plan',
        subjectId: 'rp-1',
      });
      expect(result.status).toBe('COMPLETED');
      expect(result.subjectType).toBe('recovery_plan');
    });

    it('includes evidence in result', async () => {
      const result = await rootCauseService.analyze({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
      });
      expect(Array.isArray(result.evidence)).toBe(true);
    });

    it('sets generatedAt to current time', async () => {
      const before = Date.now();
      const result = await rootCauseService.analyze({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
      });
      expect(result.generatedAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('generates UUID id', async () => {
      const result = await rootCauseService.analyze({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
      });
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});
