import { describe, it, expect } from 'vitest';
import { RouteScoring } from './route-scoring';
import { ROUTE_SCORING_WEIGHTS } from '@airove/shared';

const scoring = new RouteScoring();

describe('RouteScoring', () => {
  describe('scoreRoute', () => {
    it('returns a score between 0 and 1', () => {
      const result = scoring.scoreRoute(
        { totalEtaMinutes: 120, riskLevel: 'low', segmentCount: 1, estimatedCost: 500 },
        360,
      );
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('returns a breakdown with all required fields', () => {
      const result = scoring.scoreRoute(
        { totalEtaMinutes: 120, riskLevel: 'low', segmentCount: 1, estimatedCost: 500 },
        360,
      );
      expect(result.breakdown).toHaveProperty('slaCompliance');
      expect(result.breakdown).toHaveProperty('eta');
      expect(result.breakdown).toHaveProperty('operationalRisk');
      expect(result.breakdown).toHaveProperty('connectionQuality');
      expect(result.breakdown).toHaveProperty('cost');
      expect(result.breakdown).toHaveProperty('handlingCapability');
    });

    it('returns reasons array', () => {
      const result = scoring.scoreRoute(
        { totalEtaMinutes: 120, riskLevel: 'low', segmentCount: 1, estimatedCost: 500 },
        360,
      );
      expect(Array.isArray(result.reasons)).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('weights sum to 1.0', () => {
      const sum =
        ROUTE_SCORING_WEIGHTS.slaCompliance +
        ROUTE_SCORING_WEIGHTS.eta +
        ROUTE_SCORING_WEIGHTS.operationalRisk +
        ROUTE_SCORING_WEIGHTS.connectionQuality +
        ROUTE_SCORING_WEIGHTS.cost +
        ROUTE_SCORING_WEIGHTS.handlingCapability;
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('gives higher score for SLA-compliant routes', () => {
      const compliant = scoring.scoreRoute(
        { totalEtaMinutes: 60, riskLevel: 'low', segmentCount: 1, estimatedCost: 300 },
        360,
      );
      const nonCompliant = scoring.scoreRoute(
        { totalEtaMinutes: 400, riskLevel: 'low', segmentCount: 1, estimatedCost: 300 },
        360,
      );
      expect(compliant.score).toBeGreaterThan(nonCompliant.score);
    });

    it('gives higher score for fewer segments', () => {
      const direct = scoring.scoreRoute(
        { totalEtaMinutes: 120, riskLevel: 'low', segmentCount: 1, estimatedCost: 500 },
        360,
      );
      const multiSegment = scoring.scoreRoute(
        { totalEtaMinutes: 120, riskLevel: 'low', segmentCount: 3, estimatedCost: 500 },
        360,
      );
      expect(direct.score).toBeGreaterThan(multiSegment.score);
    });

    it('gives higher score for lower risk', () => {
      const lowRisk = scoring.scoreRoute(
        { totalEtaMinutes: 120, riskLevel: 'low', segmentCount: 1, estimatedCost: 500 },
        360,
      );
      const criticalRisk = scoring.scoreRoute(
        { totalEtaMinutes: 120, riskLevel: 'critical', segmentCount: 1, estimatedCost: 500 },
        360,
      );
      expect(lowRisk.score).toBeGreaterThan(criticalRisk.score);
    });

    it('gives higher score for lower cost', () => {
      const cheap = scoring.scoreRoute(
        { totalEtaMinutes: 120, riskLevel: 'low', segmentCount: 1, estimatedCost: 200 },
        360,
      );
      const expensive = scoring.scoreRoute(
        { totalEtaMinutes: 120, riskLevel: 'low', segmentCount: 1, estimatedCost: 5000 },
        360,
      );
      expect(cheap.score).toBeGreaterThan(expensive.score);
    });

    it('handles null estimatedCost with neutral score', () => {
      const result = scoring.scoreRoute(
        { totalEtaMinutes: 120, riskLevel: 'low', segmentCount: 1, estimatedCost: null },
        360,
      );
      expect(result.breakdown.cost).toBe(0.5);
    });

    it('handles null totalEtaMinutes with neutral score', () => {
      const result = scoring.scoreRoute(
        { totalEtaMinutes: null, riskLevel: 'low', segmentCount: 1, estimatedCost: 500 },
        360,
      );
      expect(result.breakdown.eta).toBe(0.5);
    });

    it('handles null slaRemainingMinutes gracefully', () => {
      const result = scoring.scoreRoute(
        { totalEtaMinutes: 120, riskLevel: 'low', segmentCount: 1, estimatedCost: 500 },
        null,
      );
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  describe('evaluateSLACompliance', () => {
    it('returns compliant: true when ETA fits within SLA', () => {
      const result = scoring.evaluateSLACompliance(360, 120);
      expect(result.compliant).toBe(true);
      expect(result.marginMinutes).toBeGreaterThan(0);
    });

    it('returns compliant: false when ETA exceeds SLA', () => {
      const result = scoring.evaluateSLACompliance(120, 360);
      expect(result.compliant).toBe(false);
      expect(result.marginMinutes).toBeLessThan(0);
    });

    it('returns neutral score when slaRemainingMinutes is null', () => {
      const result = scoring.evaluateSLACompliance(null, 120);
      expect(result.score).toBe(0.5);
      expect(result.compliant).toBe(true);
    });
  });

  describe('evaluateETA', () => {
    it('returns perfect score for fast ETA', () => {
      const result = scoring.evaluateETA(60, 360);
      expect(result.score).toBe(1.0);
    });

    it('returns lower score for slow ETA', () => {
      const result = scoring.evaluateETA(350, 360);
      expect(result.score).toBeLessThan(1.0);
    });

    it('returns very low score for ETA exceeding SLA', () => {
      const result = scoring.evaluateETA(500, 360);
      expect(result.score).toBe(0.2);
    });
  });

  describe('evaluateRisk', () => {
    it('returns 1.0 for low risk', () => {
      expect(scoring.evaluateRisk('low').score).toBe(1.0);
    });

    it('returns 0.7 for medium risk', () => {
      expect(scoring.evaluateRisk('medium').score).toBe(0.7);
    });

    it('returns 0.4 for high risk', () => {
      expect(scoring.evaluateRisk('high').score).toBe(0.4);
    });

    it('returns 0.1 for critical risk', () => {
      expect(scoring.evaluateRisk('critical').score).toBe(0.1);
    });

    it('returns neutral for unknown risk', () => {
      expect(scoring.evaluateRisk('unknown').score).toBe(0.5);
    });
  });

  describe('evaluateConnections', () => {
    it('returns 1.0 for direct route', () => {
      expect(scoring.evaluateConnections(1).score).toBe(1.0);
    });

    it('returns 0.8 for 2 segments', () => {
      expect(scoring.evaluateConnections(2).score).toBe(0.8);
    });

    it('returns 0.6 for 3 segments', () => {
      expect(scoring.evaluateConnections(3).score).toBe(0.6);
    });

    it('returns 0.3 for 4+ segments', () => {
      expect(scoring.evaluateConnections(5).score).toBe(0.3);
    });
  });

  describe('evaluateCost', () => {
    it('returns 1.0 for cheap routes', () => {
      expect(scoring.evaluateCost(200).score).toBe(1.0);
    });

    it('returns 0.5 for null cost', () => {
      expect(scoring.evaluateCost(null).score).toBe(0.5);
    });

    it('returns 0.2 for very expensive routes', () => {
      expect(scoring.evaluateCost(8000).score).toBe(0.2);
    });
  });

  describe('evaluateHandling', () => {
    it('returns 1.0 for direct route', () => {
      expect(scoring.evaluateHandling(1).score).toBe(1.0);
    });

    it('returns 0.8 for 2 segments', () => {
      expect(scoring.evaluateHandling(2).score).toBe(0.8);
    });

    it('returns 0.5 for 3+ segments', () => {
      expect(scoring.evaluateHandling(4).score).toBe(0.5);
    });
  });

  describe('generateReasons', () => {
    it('includes SLA compliance reason', () => {
      const reasons = scoring.generateReasons(
        { slaCompliance: 0.9, eta: 0.9, operationalRisk: 0.8, connectionQuality: 0.9, cost: 0.8, handlingCapability: 0.9 },
        true,
        'low',
        1,
      );
      expect(reasons.some(r => r.includes('SLA compliant'))).toBe(true);
    });

    it('includes risk reason for high risk', () => {
      const reasons = scoring.generateReasons(
        { slaCompliance: 0.9, eta: 0.9, operationalRisk: 0.3, connectionQuality: 0.9, cost: 0.8, handlingCapability: 0.9 },
        true,
        'high',
        1,
      );
      expect(reasons.some(r => r.includes('high operational risk'))).toBe(true);
    });

    it('includes connection quality for good connections', () => {
      const reasons = scoring.generateReasons(
        { slaCompliance: 0.9, eta: 0.9, operationalRisk: 0.8, connectionQuality: 0.9, cost: 0.8, handlingCapability: 0.9 },
        true,
        'low',
        1,
      );
      expect(reasons.some(r => r.includes('good connection quality'))).toBe(true);
    });
  });
});
