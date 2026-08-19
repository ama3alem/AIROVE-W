import pino from 'pino';
import { GRAPH_TRAVERSAL_LIMITS } from '@airove/shared';
import type { RecoveryRouteSegment, RouteConstraint, RouteConstraintType } from '@airove/shared';

const logger = pino({ name: 'layer6-route-validator' });

interface ValidationResult {
  valid: boolean;
  hardConstraints: RouteConstraint[];
  softConstraints: RouteConstraint[];
}

export class RouteValidator {
  validateRoute(segments: RecoveryRouteSegment[]): ValidationResult {
    const hardConstraints = this.validateHardConstraints(segments);
    const softConstraints = this.evaluateSoftConstraints(segments);

    return {
      valid: hardConstraints.length === 0,
      hardConstraints,
      softConstraints,
    };
  }

  validateHardConstraints(segments: RecoveryRouteSegment[]): RouteConstraint[] {
    const constraints: RouteConstraint[] = [];

    if (segments.length === 0) {
      constraints.push(this.makeConstraint('connection_impossible', 'Route has no segments'));
      return constraints;
    }

    if (segments.length > GRAPH_TRAVERSAL_LIMITS.maxHops) {
      constraints.push(this.makeConstraint(
        'capacity_exceeded',
        `Route exceeds maximum hops: ${segments.length} > ${GRAPH_TRAVERSAL_LIMITS.maxHops}`,
      ));
    }

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;

      if (seg.segmentOrder !== i + 1) {
        constraints.push(this.makeConstraint(
          'connection_impossible',
          `Segment order mismatch at position ${i + 1}`,
        ));
      }

      if (i > 0) {
        const prev = segments[i - 1]!;
        if (prev.destination !== seg.origin) {
          constraints.push(this.makeConstraint(
            'connection_impossible',
            `Connection break: ${prev.destination} → ${seg.origin} at segment ${i + 1}`,
          ));
        }

        if (seg.connectionMinutes !== null && seg.connectionMinutes < 30) {
          constraints.push(this.makeConstraint(
            'cutoff_missed',
            `Connection too short: ${seg.connectionMinutes}min at segment ${i + 1}`,
          ));
        }
      }
    }

    this.checkGraphLimits(segments).forEach((c) => constraints.push(c));

    return constraints;
  }

  evaluateSoftConstraints(segments: RecoveryRouteSegment[]): RouteConstraint[] {
    const constraints: RouteConstraint[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;

      if (seg.connectionMinutes !== null && seg.connectionMinutes < 60 && i < segments.length - 1) {
        constraints.push(this.makeConstraint(
          'connection_impossible',
          `Short connection time: ${seg.connectionMinutes}min at segment ${i + 1}`,
        ));
      }

      if (seg.durationMinutes !== null && seg.durationMinutes > 720) {
        constraints.push(this.makeConstraint(
          'capacity_exceeded',
          `Long segment duration: ${seg.durationMinutes}min at segment ${i + 1}`,
        ));
      }
    }

    if (segments.length > 3) {
      constraints.push(this.makeConstraint(
        'capacity_exceeded',
        `Complex routing with ${segments.length} segments`,
      ));
    }

    return constraints;
  }

  checkGraphLimits(segments: RecoveryRouteSegment[]): RouteConstraint[] {
    const constraints: RouteConstraint[] = [];

    if (segments.length > GRAPH_TRAVERSAL_LIMITS.maxHops) {
      constraints.push(this.makeConstraint(
        'capacity_exceeded',
        `Exceeds maximum hops (${GRAPH_TRAVERSAL_LIMITS.maxHops})`,
      ));
    }

    return constraints;
  }

  isRoutePlausible(totalEtaMinutes: number | null, slaRemainingMinutes: number | null): boolean {
    if (totalEtaMinutes === null || slaRemainingMinutes === null) return true;
    return totalEtaMinutes <= slaRemainingMinutes * 1.2;
  }

  private makeConstraint(type: RouteConstraintType, description: string): RouteConstraint {
    return {
      id: '',
      orgId: '',
      recoveryPlanId: null,
      routeOptionId: null,
      constraintType: type,
      severity: 'hard',
      description,
      details: null,
      createdAt: new Date(),
    };
  }
}

export const routeValidator = new RouteValidator();
