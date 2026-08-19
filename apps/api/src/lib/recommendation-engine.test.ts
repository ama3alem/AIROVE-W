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

import { recommendationEngine } from './recommendation-engine';
import type { PredictionResult } from './prediction-engine';
import type { RiskAssessmentResult } from './risk-intelligence-service';
import type { RootCauseResult } from './root-cause-service';
import type { AnomalyResult } from './anomaly-detection-service';

const now = new Date();

function basePrediction(overrides?: Partial<PredictionResult>): PredictionResult {
  return {
    id: 'pred-1',
    organizationId: 'org-1',
    predictionType: 'TRANSFER_FAILURE',
    subjectType: 'baggage',
    subjectId: 'bag-1',
    probability: 0.85,
    confidence: 'HIGH',
    horizon: 240,
    evidence: [{ sourceType: 'baggage', sourceId: 'bag-1', reason: 'no events' }],
    explanation: 'High transfer failure risk',
    model: 'deterministic',
    version: 'heuristic-v1',
    generatedAt: now,
    expiresAt: new Date(now.getTime() + 240 * 60000),
    status: 'COMPLETED',
    ...overrides,
  };
}

function baseRisk(overrides?: Partial<RiskAssessmentResult>): RiskAssessmentResult {
  return {
    id: 'risk-1',
    organizationId: 'org-1',
    subjectType: 'baggage',
    subjectId: 'bag-1',
    riskLevel: 'HIGH',
    factors: [{ name: 'missing_events', weight: 0.8, description: 'no tracking' }],
    evidence: [{ sourceType: 'baggage', sourceId: 'bag-1', reason: 'high risk' }],
    explanation: 'High risk',
    confidence: 'HIGH',
    generatedAt: now,
    model: 'deterministic',
    version: 'heuristic-v1',
    status: 'COMPLETED',
    ...overrides,
  };
}

function baseRootCause(overrides?: Partial<RootCauseResult>): RootCauseResult {
  return {
    id: 'rc-1',
    organizationId: 'org-1',
    subjectType: 'baggage',
    subjectId: 'bag-1',
    candidates: [{ cause: 'no_tracking_events', confidence: 'HIGH', evidence: [], description: 'no events' }],
    evidence: [],
    explanation: 'Root cause',
    confidence: 'HIGH',
    generatedAt: now,
    model: 'deterministic',
    version: 'heuristic-v1',
    status: 'COMPLETED',
    ...overrides,
  };
}

function baseAnomaly(overrides?: Partial<AnomalyResult>): AnomalyResult {
  return {
    id: 'anom-1',
    organizationId: 'org-1',
    anomalyType: 'event_gap',
    subjectType: 'baggage',
    subjectId: 'bag-1',
    severity: 'MEDIUM',
    score: 0.7,
    expectedBehavior: 'regular events',
    observedBehavior: 'no events',
    evidence: [],
    explanation: 'Gap detected',
    confidence: 'MEDIUM',
    generatedAt: now,
    model: 'deterministic',
    version: 'heuristic-v1',
    status: 'COMPLETED',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RecommendationEngine', () => {
  describe('generateRecommendations', () => {
    it('returns default recommendation when no context provided', async () => {
      const results = await recommendationEngine.generateRecommendations({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
      });
      expect(results.length).toBeGreaterThan(0);
      const first = results[0]!;
      expect(first.organizationId).toBe('org-1');
      expect(first.status).toBe('COMPLETED');
      expect(first.priority).toBe('LOW');
    });

    it('generates recommendation from high-probability prediction', async () => {
      const results = await recommendationEngine.generateRecommendations({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        prediction: basePrediction({ probability: 0.9, confidence: 'VERY_HIGH' }),
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.recommendation.length > 0)).toBe(true);
    });

    it('generates recommendation from CRITICAL risk assessment', async () => {
      const results = await recommendationEngine.generateRecommendations({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        riskAssessment: baseRisk({ riskLevel: 'CRITICAL' }),
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.priority === 'CRITICAL' || r.priority === 'HIGH')).toBe(true);
    });

    it('generates recommendation from root cause', async () => {
      const results = await recommendationEngine.generateRecommendations({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        rootCause: baseRootCause(),
      });
      expect(results.length).toBeGreaterThan(0);
    });

    it('generates recommendation from anomalies', async () => {
      const results = await recommendationEngine.generateRecommendations({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        anomalies: [baseAnomaly()],
      });
      expect(results.length).toBeGreaterThan(0);
    });

    it('combines multiple sources and prioritizes', async () => {
      const results = await recommendationEngine.generateRecommendations({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        prediction: basePrediction({ probability: 0.9 }),
        riskAssessment: baseRisk({ riskLevel: 'CRITICAL' }),
        rootCause: baseRootCause(),
        anomalies: [baseAnomaly()],
      });
      expect(results.length).toBeGreaterThan(0);
    });

    it('sets requiredApproval for critical recommendations', async () => {
      const results = await recommendationEngine.generateRecommendations({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        riskAssessment: baseRisk({ riskLevel: 'CRITICAL' }),
      });
      const criticalRecs = results.filter(r => r.priority === 'CRITICAL');
      if (criticalRecs.length > 0) {
        expect(criticalRecs[0]!.requiredApproval).toBeDefined();
      }
    });

    it('skips failed predictions but returns default', async () => {
      const results = await recommendationEngine.generateRecommendations({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        prediction: basePrediction({ status: 'FAILED' }),
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.priority).toBe('LOW');
    });

    it('skips failed anomalies but returns default', async () => {
      const results = await recommendationEngine.generateRecommendations({
        orgId: 'org-1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        anomalies: [baseAnomaly({ status: 'FAILED' })],
      });
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
