import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    query: {
      baggageStateProjections: { findFirst: vi.fn().mockResolvedValue(null) },
      expectedEvents: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      cases: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      tasks: { findMany: vi.fn().mockResolvedValue([]) },
      caseEscalations: { findMany: vi.fn().mockResolvedValue([]) },
      caseSla: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      recoveryPlans: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      analyticsSnapshots: { findMany: vi.fn().mockResolvedValue([]) },
      recoveryProviders: { findMany: vi.fn().mockResolvedValue([]) },
    },
  },
}));

vi.mock('@airove/db', () => ({
  db: mockDb,
  baggageStateProjections: {},
  expectedEvents: {},
  cases: {},
  tasks: {},
  caseEscalations: {},
  caseSla: {},
  recoveryPlans: {},
  analyticsSnapshots: {},
  recoveryProviders: {},
}));

import { AIFeatureService } from './ai-feature-service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AIFeatureService', () => {
  const service = new AIFeatureService();

  describe('gatherBaggageFeatures', () => {
    it('returns feature set with default values when no data', async () => {
      const result = await service.gatherBaggageFeatures('org-1', 'bag-1');
      expect(result.subjectType).toBe('baggage');
      expect(result.subjectId).toBe('bag-1');
      expect(result.featureVersion).toBe('1.0.0');
      expect(typeof result.features).toBe('object');
      expect(Array.isArray(result.evidence)).toBe(true);
    });

    it('includes current_state feature', async () => {
      const result = await service.gatherBaggageFeatures('org-1', 'bag-1');
      expect(result.features).toHaveProperty('current_state');
    });

    it('includes event_count feature', async () => {
      const result = await service.gatherBaggageFeatures('org-1', 'bag-1');
      expect(result.features).toHaveProperty('event_count');
    });

    it('sets generatedAt', async () => {
      const before = Date.now();
      const result = await service.gatherBaggageFeatures('org-1', 'bag-1');
      expect(result.generatedAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('populates features from projection when data exists', async () => {
      mockDb.query.baggageStateProjections.findFirst.mockResolvedValueOnce({
        id: 'proj-1',
        currentState: 'in_transit',
        eventCount: 5,
      });
      const result = await service.gatherBaggageFeatures('org-1', 'bag-1');
      expect(result.features['current_state']).toBe('in_transit');
      expect(result.features['event_count']).toBe(5);
      expect(result.evidence.length).toBeGreaterThan(0);
    });
  });

  describe('gatherCaseFeatures', () => {
    it('returns feature set for case', async () => {
      const result = await service.gatherCaseFeatures('org-1', 'case-1');
      expect(result.subjectType).toBe('case');
      expect(result.subjectId).toBe('case-1');
      expect(typeof result.features).toBe('object');
    });

    it('includes case_status feature', async () => {
      const result = await service.gatherCaseFeatures('org-1', 'case-1');
      expect(result.features).toHaveProperty('case_status');
    });

    it('includes case_age_minutes feature', async () => {
      const result = await service.gatherCaseFeatures('org-1', 'case-1');
      expect(result.features).toHaveProperty('case_age_minutes');
    });

    it('returns early with unknown status when case not found', async () => {
      mockDb.query.cases.findFirst.mockResolvedValueOnce(null);
      const result = await service.gatherCaseFeatures('org-1', 'case-1');
      expect(result.features['case_status']).toBe('unknown');
      expect(result.features['case_age_minutes']).toBe(-1);
    });
  });

  describe('gatherAirportFeatures', () => {
    it('returns feature set for airport', async () => {
      const result = await service.gatherAirportFeatures('org-1', 'JFK');
      expect(result.subjectType).toBe('airport');
      expect(result.subjectId).toBe('JFK');
      expect(typeof result.features).toBe('object');
    });
  });
});
