import { db, recoveryPlans, recoveryRouteOptions, recoveryRouteSegments, recoveryExecutions } from '@airove/db';
import { eq, and, asc } from 'drizzle-orm';
import pino from 'pino';
import type { RecoveryMapView, RecoveryMapSegment, RecoveryExecutionStatus, RecoveryRiskLevel } from '@airove/shared';

const logger = pino({ name: 'layer6-recovery-map' });

export class RecoveryMapService {
  async getMapView(planId: string, orgId: string): Promise<RecoveryMapView | null> {
    const plan = await db.query.recoveryPlans.findFirst({
      where: and(eq(recoveryPlans.id, planId), eq(recoveryPlans.orgId, orgId)),
    });

    if (!plan) {
      return null;
    }

    let segments: RecoveryMapSegment[] = [];
    let activeSegmentIndex: number | null = null;
    let completedSegments = 0;
    let totalSegments = 0;
    let etaMinutes: number | null = null;
    let riskLevel: RecoveryRiskLevel | null = null;
    let slaCompliant: boolean | null = null;

    if (plan.selectedRouteOptionId) {
      const routeOption = await db.query.recoveryRouteOptions.findFirst({
        where: and(
          eq(recoveryRouteOptions.id, plan.selectedRouteOptionId),
          eq(recoveryRouteOptions.orgId, orgId),
        ),
      });

      if (routeOption) {
        segments = await this.buildMapSegments(plan.selectedRouteOptionId, orgId);

        totalSegments = segments.length;
        completedSegments = segments.filter((s) => s.status === 'completed').length;
        activeSegmentIndex = segments.findIndex((s) => s.status !== 'completed');
        if (activeSegmentIndex === -1) activeSegmentIndex = null;

        etaMinutes = routeOption.totalEtaMinutes;
        riskLevel = routeOption.riskLevel as RecoveryRiskLevel;
        slaCompliant = routeOption.slaCompliant;
      }
    }

    let executionStatus: RecoveryExecutionStatus | null = null;
    const execution = await db.query.recoveryExecutions.findFirst({
      where: eq(recoveryExecutions.recoveryPlanId, planId),
    });
    if (execution) {
      executionStatus = execution.status as RecoveryExecutionStatus;
    }

    return {
      planId: plan.id,
      planNumber: plan.planNumber,
      status: plan.status as RecoveryMapView['status'],
      baggageId: plan.baggageId,
      origin: plan.origin,
      destination: plan.destination,
      currentLocation: plan.currentLocation,
      selectedRouteOptionId: plan.selectedRouteOptionId,
      segments,
      activeSegmentIndex,
      completedSegments,
      totalSegments,
      etaMinutes,
      riskLevel,
      slaRemainingMinutes: plan.slaRemainingMinutes,
      slaCompliant,
      executionStatus,
    };
  }

  getSegmentStatus(
    actualSegments: Array<{ status: string; origin: string; destination: string }>,
    plannedSegments: RecoveryMapSegment[],
  ): RecoveryMapSegment['status'][] {
    return plannedSegments.map((planned) => {
      const match = actualSegments.find(
        (actual) =>
          actual.origin === planned.origin &&
          actual.destination === planned.destination,
      );

      if (!match) {
        return planned.status;
      }

      if (match.status === 'completed' || match.status === 'delivered') {
        return 'completed';
      }

      if (match.status === 'in_transit' || match.status === 'active') {
        return 'in_transit';
      }

      return 'planned';
    });
  }

  async buildMapSegments(
    routeOptionId: string,
    orgId: string,
  ): Promise<RecoveryMapSegment[]> {
    const rows = await db
      .select()
      .from(recoveryRouteSegments)
      .where(
        and(
          eq(recoveryRouteSegments.routeOptionId, routeOptionId),
          eq(recoveryRouteSegments.orgId, orgId),
        ),
      )
      .orderBy(asc(recoveryRouteSegments.segmentOrder));

    return rows.map((row) => ({
      segmentOrder: row.segmentOrder,
      origin: row.origin,
      destination: row.destination,
      mode: row.mode as RecoveryMapSegment['mode'],
      carrier: row.carrier,
      flightNumber: row.flightNumber,
      status: row.status as RecoveryMapSegment['status'],
      scheduledDeparture: row.scheduledDeparture,
      scheduledArrival: row.scheduledArrival,
      durationMinutes: row.durationMinutes,
      riskLevel: row.riskLevel as RecoveryRiskLevel | null,
    }));
  }
}

export const recoveryMapService = new RecoveryMapService();
