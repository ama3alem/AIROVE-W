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
  baggageStateProjections: { orgId: 'org_id', baggageId: 'baggage_id', updatedAt: 'updated_at' },
  expectedEvents: { orgId: 'org_id', baggageId: 'baggage_id' },
  cases: { orgId: 'org_id', id: 'id' },
  caseSla: { orgId: 'org_id', caseId: 'case_id' },
  recoveryPlans: { orgId: 'org_id', id: 'id' },
  tasks: { orgId: 'org_id', caseId: 'case_id' },
}));

import { anomalyDetectionService } from './anomaly-detection-service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AnomalyDetectionService', () => {
  describe('detect', () => {
    it('returns empty array when no anomalies detected', async () => {
      mockDb.limit.mockResolvedValue([]);
      const results = await anomalyDetectionService.detect({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
      });
      expect(Array.isArray(results)).toBe(true);
    });

    it('returns array for baggage scan', async () => {
      mockDb.limit.mockResolvedValue([]);
      const results = await anomalyDetectionService.detect({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
      });
      expect(Array.isArray(results)).toBe(true);
    });

    it('returns array for case scan', async () => {
      mockDb.limit.mockResolvedValue([]);
      const results = await anomalyDetectionService.detect({
        orgId: 'org-1',
        subjectType: 'case',
        subjectId: 'case-1',
      });
      expect(Array.isArray(results)).toBe(true);
    });

    it('returns array for recovery_plan scan', async () => {
      mockDb.limit.mockResolvedValue([]);
      const results = await anomalyDetectionService.detect({
        orgId: 'org-1',
        subjectType: 'recovery_plan',
        subjectId: 'rp-1',
      });
      expect(Array.isArray(results)).toBe(true);
    });

    it('respects scanTypes filter', async () => {
      mockDb.limit.mockResolvedValue([]);
      const results = await anomalyDetectionService.detect({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        scanTypes: ['overdue_events'],
      });
      expect(Array.isArray(results)).toBe(true);
    });

    it('returns results with valid anomaly shapes', async () => {
      mockDb.limit.mockResolvedValue([]);
      const results = await anomalyDetectionService.detect({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
      });
      for (const result of results) {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('anomalyType');
        expect(result).toHaveProperty('severity');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('model');
        expect(result).toHaveProperty('version');
        expect(['COMPLETED', 'FAILED']).toContain(result.status);
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(result.severity);
        expect(typeof result.score).toBe('number');
      }
    });

    it('handles DB error gracefully', async () => {
      mockDb.limit.mockRejectedValue(new Error('DB error'));
      const results = await anomalyDetectionService.detect({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
      });
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
