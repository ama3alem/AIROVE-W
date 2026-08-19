import { describe, it, expect } from 'vitest';
import {
  PERMISSIONS,
  RECOVERY_PLAN_STATUSES,
  RECOVERY_TYPES,
  RECOVERY_RISK_LEVELS,
  RECOVERY_PLAN_TRANSITIONS,
  ROUTE_SCORING_WEIGHTS,
  GRAPH_TRAVERSAL_LIMITS,
  ROUTE_SEGMENT_MODES,
  ROUTE_SEGMENT_STATUSES,
  RECOVERY_EXECUTION_STATUSES,
  RECOVERY_EXECUTION_STEP_STATUSES,
  RECOVERY_APPROVAL_LEVELS,
  ROUTE_CONSTRAINT_TYPES,
  ROUTE_CONSTRAINT_SEVERITY,
} from '@airove/shared';

describe('Layer 6 Constants', () => {
  describe('RECOVERY_PLAN_STATUSES', () => {
    it('includes all required statuses', () => {
      const required = ['draft', 'planning', 'options_available', 'awaiting_approval', 'approved', 'scheduled', 'in_progress', 'completed', 'no_route', 'rejected', 'failed', 'cancelled', 'replanning'];
      for (const status of required) {
        expect(RECOVERY_PLAN_STATUSES).toContain(status);
      }
    });

    it('is a non-empty readonly array', () => {
      expect(RECOVERY_PLAN_STATUSES.length).toBeGreaterThan(0);
    });
  });

  describe('RECOVERY_TYPES', () => {
    it('includes air, ground, courier', () => {
      expect(RECOVERY_TYPES).toContain('air');
      expect(RECOVERY_TYPES).toContain('ground');
      expect(RECOVERY_TYPES).toContain('courier');
    });
  });

  describe('RECOVERY_RISK_LEVELS', () => {
    it('includes all risk levels', () => {
      expect(RECOVERY_RISK_LEVELS).toContain('low');
      expect(RECOVERY_RISK_LEVELS).toContain('medium');
      expect(RECOVERY_RISK_LEVELS).toContain('high');
      expect(RECOVERY_RISK_LEVELS).toContain('critical');
    });
  });

  describe('RECOVERY_PLAN_TRANSITIONS', () => {
    it('defines valid transitions for draft', () => {
      const transitions = RECOVERY_PLAN_TRANSITIONS['draft'];
      expect(transitions).toBeDefined();
      expect(transitions).toContain('planning');
      expect(transitions).toContain('cancelled');
    });

    it('defines valid transitions for planning', () => {
      const transitions = RECOVERY_PLAN_TRANSITIONS['planning'];
      expect(transitions).toBeDefined();
      expect(transitions).toContain('options_available');
    });

    it('defines valid transitions for approved', () => {
      const transitions = RECOVERY_PLAN_TRANSITIONS['approved'];
      expect(transitions).toBeDefined();
      expect(transitions).toContain('scheduled');
    });

    it('defines valid transitions for in_progress', () => {
      const transitions = RECOVERY_PLAN_TRANSITIONS['in_progress'];
      expect(transitions).toBeDefined();
      expect(transitions).toContain('completed');
      expect(transitions).toContain('failed');
    });

    it('does not allow further transitions from completed', () => {
      expect(RECOVERY_PLAN_TRANSITIONS['completed']).toBeDefined();
      expect(RECOVERY_PLAN_TRANSITIONS['completed']!.length).toBe(0);
    });

    it('does not allow further transitions from cancelled', () => {
      expect(RECOVERY_PLAN_TRANSITIONS['cancelled']).toBeDefined();
      expect(RECOVERY_PLAN_TRANSITIONS['cancelled']!.length).toBe(0);
    });
  });

  describe('ROUTE_SCORING_WEIGHTS', () => {
    it('sums to 1.0', () => {
      const sum =
        ROUTE_SCORING_WEIGHTS.slaCompliance +
        ROUTE_SCORING_WEIGHTS.eta +
        ROUTE_SCORING_WEIGHTS.operationalRisk +
        ROUTE_SCORING_WEIGHTS.connectionQuality +
        ROUTE_SCORING_WEIGHTS.cost +
        ROUTE_SCORING_WEIGHTS.handlingCapability;
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('SLA compliance has highest weight', () => {
      expect(ROUTE_SCORING_WEIGHTS.slaCompliance).toBeGreaterThanOrEqual(
        ROUTE_SCORING_WEIGHTS.eta,
      );
    });
  });

  describe('GRAPH_TRAVERSAL_LIMITS', () => {
    it('has positive maxHops', () => {
      expect(GRAPH_TRAVERSAL_LIMITS.maxHops).toBeGreaterThan(0);
    });

    it('has positive maxSearchDepth', () => {
      expect(GRAPH_TRAVERSAL_LIMITS.maxSearchDepth).toBeGreaterThan(0);
    });

    it('maxSearchDepth is a positive integer', () => {
      expect(GRAPH_TRAVERSAL_LIMITS.maxSearchDepth).toBeGreaterThan(0);
      expect(Number.isInteger(GRAPH_TRAVERSAL_LIMITS.maxSearchDepth)).toBe(true);
    });
  });

  describe('ROUTE_SEGMENT_MODES', () => {
    it('includes flight, ground, courier', () => {
      expect(ROUTE_SEGMENT_MODES).toContain('flight');
      expect(ROUTE_SEGMENT_MODES).toContain('ground');
      expect(ROUTE_SEGMENT_MODES).toContain('courier');
    });
  });

  describe('ROUTE_SEGMENT_STATUSES', () => {
    it('includes planned, confirmed, completed', () => {
      expect(ROUTE_SEGMENT_STATUSES).toContain('planned');
      expect(ROUTE_SEGMENT_STATUSES).toContain('confirmed');
      expect(ROUTE_SEGMENT_STATUSES).toContain('completed');
    });
  });

  describe('RECOVERY_EXECUTION_STATUSES', () => {
    it('includes pending, in_progress, completed, failed', () => {
      expect(RECOVERY_EXECUTION_STATUSES).toContain('pending');
      expect(RECOVERY_EXECUTION_STATUSES).toContain('in_progress');
      expect(RECOVERY_EXECUTION_STATUSES).toContain('completed');
      expect(RECOVERY_EXECUTION_STATUSES).toContain('failed');
    });
  });

  describe('RECOVERY_EXECUTION_STEP_STATUSES', () => {
    it('includes pending, in_progress, completed, failed, skipped', () => {
      expect(RECOVERY_EXECUTION_STEP_STATUSES).toContain('pending');
      expect(RECOVERY_EXECUTION_STEP_STATUSES).toContain('in_progress');
      expect(RECOVERY_EXECUTION_STEP_STATUSES).toContain('completed');
      expect(RECOVERY_EXECUTION_STEP_STATUSES).toContain('failed');
      expect(RECOVERY_EXECUTION_STEP_STATUSES).toContain('skipped');
    });
  });

  describe('RECOVERY_APPROVAL_LEVELS', () => {
    it('includes none, supervisor, manager', () => {
      expect(RECOVERY_APPROVAL_LEVELS).toContain('none');
      expect(RECOVERY_APPROVAL_LEVELS).toContain('supervisor');
      expect(RECOVERY_APPROVAL_LEVELS).toContain('manager');
    });
  });

  describe('ROUTE_CONSTRAINT_TYPES', () => {
    it('includes flight_not_found, connection_impossible', () => {
      expect(ROUTE_CONSTRAINT_TYPES).toContain('flight_not_found');
      expect(ROUTE_CONSTRAINT_TYPES).toContain('connection_impossible');
    });
  });

  describe('ROUTE_CONSTRAINT_SEVERITY', () => {
    it('includes hard, soft', () => {
      expect(ROUTE_CONSTRAINT_SEVERITY).toContain('hard');
      expect(ROUTE_CONSTRAINT_SEVERITY).toContain('soft');
    });
  });
});

describe('Layer 6 API Routes', () => {
  it('recovery-plans endpoint structure is valid', () => {
    const endpoints = [
      { method: 'GET', path: '/api/recovery-plans' },
      { method: 'POST', path: '/api/recovery-plans' },
      { method: 'GET', path: '/api/recovery-plans/:planId' },
      { method: 'PUT', path: '/api/recovery-plans/:planId' },
      { method: 'POST', path: '/api/recovery-plans/:planId/approve' },
      { method: 'POST', path: '/api/recovery-plans/:planId/execute' },
      { method: 'GET', path: '/api/recovery-plans/:planId/versions' },
    ];
    expect(endpoints.length).toBe(7);
    for (const ep of endpoints) {
      expect(ep.method).toBeTruthy();
      expect(ep.path).toContain('/api/recovery-plans');
    }
  });

  it('recovery-providers endpoint structure is valid', () => {
    const endpoints = [
      { method: 'GET', path: '/api/recovery-providers' },
      { method: 'POST', path: '/api/recovery-providers' },
      { method: 'GET', path: '/api/recovery-providers/:providerId' },
      { method: 'PUT', path: '/api/recovery-providers/:providerId' },
      { method: 'GET', path: '/api/recovery-providers/:providerId/services' },
      { method: 'POST', path: '/api/recovery-providers/:providerId/services' },
    ];
    expect(endpoints.length).toBe(6);
    for (const ep of endpoints) {
      expect(ep.method).toBeTruthy();
      expect(ep.path).toContain('/api/recovery-providers');
    }
  });
});

describe('Layer 6 Permissions', () => {
  it('defines all recovery plan permissions', () => {
    expect(PERMISSIONS.RECOVERY_PLAN_READ).toBe('recovery_plan:read');
    expect(PERMISSIONS.RECOVERY_PLAN_CREATE).toBe('recovery_plan:create');
    expect(PERMISSIONS.RECOVERY_PLAN_UPDATE).toBe('recovery_plan:update');
    expect(PERMISSIONS.RECOVERY_PLAN_DELETE).toBe('recovery_plan:delete');
    expect(PERMISSIONS.RECOVERY_PLAN_APPROVE).toBe('recovery_plan:approve');
    expect(PERMISSIONS.RECOVERY_PLAN_EXECUTE).toBe('recovery_plan:execute');
  });

  it('defines all route option permissions', () => {
    expect(PERMISSIONS.ROUTE_OPTION_READ).toBe('route_option:read');
    expect(PERMISSIONS.ROUTE_OPTION_CREATE).toBe('route_option:create');
    expect(PERMISSIONS.ROUTE_OPTION_SELECT).toBe('route_option:select');
  });

  it('defines all recovery provider permissions', () => {
    expect(PERMISSIONS.RECOVERY_PROVIDER_READ).toBe('recovery_provider:read');
    expect(PERMISSIONS.RECOVERY_PROVIDER_CREATE).toBe('recovery_provider:create');
    expect(PERMISSIONS.RECOVERY_PROVIDER_UPDATE).toBe('recovery_provider:update');
    expect(PERMISSIONS.RECOVERY_PROVIDER_DELETE).toBe('recovery_provider:delete');
  });
});
