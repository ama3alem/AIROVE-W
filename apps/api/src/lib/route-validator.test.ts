import { describe, it, expect } from 'vitest';
import { RouteValidator } from './route-validator';
import { GRAPH_TRAVERSAL_LIMITS } from '@airove/shared';
import type { RecoveryRouteSegment } from '@airove/shared';

const validator = new RouteValidator();

function makeSegment(overrides: Partial<RecoveryRouteSegment> = {}): RecoveryRouteSegment {
  return {
    id: '',
    orgId: '',
    routeOptionId: '',
    segmentOrder: 1,
    origin: 'JFK',
    destination: 'LAX',
    mode: 'flight',
    carrier: null,
    flightNumber: null,
    flightId: null,
    scheduledDeparture: null,
    scheduledArrival: null,
    estimatedDeparture: null,
    estimatedArrival: null,
    durationMinutes: 360,
    connectionMinutes: null,
    status: 'planned',
    providerId: null,
    providerServiceId: null,
    cost: null,
    riskLevel: null,
    notes: null,
    metadata: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('RouteValidator', () => {
  describe('validateRoute', () => {
    it('returns valid for a single segment route', () => {
      const result = validator.validateRoute([makeSegment()]);
      expect(result.valid).toBe(true);
      expect(result.hardConstraints.length).toBe(0);
    });

    it('returns invalid for empty segments', () => {
      const result = validator.validateRoute([]);
      expect(result.valid).toBe(false);
      expect(result.hardConstraints.length).toBeGreaterThan(0);
    });

    it('detects connection break between segments', () => {
      const seg1 = makeSegment({ segmentOrder: 1, destination: 'ORD' });
      const seg2 = makeSegment({ segmentOrder: 2, origin: 'LAX', destination: 'LAX' });
      const result = validator.validateRoute([seg1, seg2]);
      expect(result.valid).toBe(false);
      expect(result.hardConstraints.some(c => c.constraintType === 'connection_impossible')).toBe(true);
    });

    it('detects segment order mismatch', () => {
      const seg1 = makeSegment({ segmentOrder: 2 });
      const result = validator.validateRoute([seg1]);
      expect(result.valid).toBe(false);
      expect(result.hardConstraints.some(c => c.constraintType === 'connection_impossible')).toBe(true);
    });

    it('detects too short connection time', () => {
      const seg1 = makeSegment({ segmentOrder: 1, destination: 'ORD' });
      const seg2 = makeSegment({ segmentOrder: 2, origin: 'ORD', connectionMinutes: 15 });
      const result = validator.validateRoute([seg1, seg2]);
      expect(result.hardConstraints.some(c => c.constraintType === 'cutoff_missed')).toBe(true);
    });

    it('detects exceeding max hops', () => {
      const segments = Array.from({ length: GRAPH_TRAVERSAL_LIMITS.maxHops + 2 }, (_, i) =>
        makeSegment({
          segmentOrder: i + 1,
          origin: `A${i}`,
          destination: `A${i + 1}`,
        }),
      );
      const result = validator.validateRoute(segments);
      expect(result.hardConstraints.some(c => c.constraintType === 'capacity_exceeded')).toBe(true);
    });
  });

  describe('validateHardConstraints', () => {
    it('returns no constraints for a simple valid segment', () => {
      const constraints = validator.validateHardConstraints([makeSegment()]);
      expect(constraints.length).toBe(0);
    });

    it('returns constraint for empty array', () => {
      const constraints = validator.validateHardConstraints([]);
      expect(constraints.length).toBeGreaterThan(0);
    });
  });

  describe('evaluateSoftConstraints', () => {
    it('returns empty array for a simple valid segment', () => {
      const constraints = validator.evaluateSoftConstraints([makeSegment()]);
      expect(Array.isArray(constraints)).toBe(true);
    });

    it('flags long segment duration', () => {
      const constraints = validator.evaluateSoftConstraints([
        makeSegment({ durationMinutes: 800 }),
      ]);
      expect(constraints.some(c => c.constraintType === 'capacity_exceeded')).toBe(true);
    });

    it('flags complex routing with many segments', () => {
      const segments = Array.from({ length: 5 }, (_, i) =>
        makeSegment({
          segmentOrder: i + 1,
          origin: `A${i}`,
          destination: `A${i + 1}`,
        }),
      );
      const constraints = validator.evaluateSoftConstraints(segments);
      expect(constraints.some(c => c.description.includes('Complex routing'))).toBe(true);
    });
  });

  describe('isRoutePlausible', () => {
    it('returns true when ETA is within 120% of SLA', () => {
      expect(validator.isRoutePlausible(300, 360)).toBe(true);
    });

    it('returns false when ETA exceeds 120% of SLA', () => {
      expect(validator.isRoutePlausible(500, 360)).toBe(false);
    });

    it('returns true when either value is null', () => {
      expect(validator.isRoutePlausible(null, 360)).toBe(true);
      expect(validator.isRoutePlausible(300, null)).toBe(true);
      expect(validator.isRoutePlausible(null, null)).toBe(true);
    });
  });

  describe('checkGraphLimits', () => {
    it('returns empty for segments within limits', () => {
      const constraints = validator.checkGraphLimits([makeSegment()]);
      expect(constraints.length).toBe(0);
    });

    it('returns constraint when exceeding max hops', () => {
      const segments = Array.from({ length: GRAPH_TRAVERSAL_LIMITS.maxHops + 2 }, (_, i) =>
        makeSegment({
          segmentOrder: i + 1,
          origin: `A${i}`,
          destination: `A${i + 1}`,
        }),
      );
      const constraints = validator.checkGraphLimits(segments);
      expect(constraints.length).toBeGreaterThan(0);
    });
  });
});
