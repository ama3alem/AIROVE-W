import { db, recoveryPlans, recoveryRouteOptions, recoveryRouteSegments, recoveryPlanVersions } from '@airove/db';
import { eq, and, sql, asc, desc } from 'drizzle-orm';
import pino from 'pino';
import { auditLog } from './audit-logger.js';
import { RECOVERY_PLAN_TRANSITIONS } from '@airove/shared';

const logger = pino({ name: 'layer6-recovery-service' });

export interface CreateRecoveryPlanInput {
  caseId: string;
  baggageId?: string;
  recoveryType: string;
  origin: string;
  destination: string;
  currentLocation?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateRecoveryPlanInput {
  recoveryType?: string;
  origin?: string;
  destination?: string;
  currentLocation?: string;
  metadata?: Record<string, unknown>;
}

export interface ListRecoveryPlanFilters {
  status?: string;
  recoveryType?: string;
  caseId?: string;
  baggageId?: string;
  page?: number;
  pageSize?: number;
}

export class RecoveryService {
  async createPlan(input: CreateRecoveryPlanInput, orgId: string, userId: string) {
    const countResult = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text as count FROM recovery_plans WHERE org_id = ${orgId}`,
    );
    const count = parseInt(countResult[0]?.count ?? '0', 10);
    const planNumber = `RP-${String(count + 1).padStart(6, '0')}`;

    const [plan] = await db.insert(recoveryPlans).values({
      orgId,
      caseId: input.caseId,
      baggageId: input.baggageId ?? null,
      planNumber,
      recoveryType: input.recoveryType,
      status: 'draft',
      origin: input.origin,
      destination: input.destination,
      currentLocation: input.currentLocation ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    }).returning();

    await auditLog({
      orgId,
      userId,
      action: 'recovery_plan_created',
      entityType: 'recovery_plan',
      entityId: plan!.id,
      entityRef: planNumber,
    });

    logger.info({ planId: plan!.id, planNumber, caseId: input.caseId }, 'Recovery plan created');
    return plan!;
  }

  async getPlan(planId: string, orgId: string) {
    const [plan] = await db.select().from(recoveryPlans).where(
      and(eq(recoveryPlans.id, planId), eq(recoveryPlans.orgId, orgId)),
    );
    if (!plan) {
      throw new Error('Recovery plan not found');
    }
    return plan;
  }

  async listPlans(orgId: string, filters: ListRecoveryPlanFilters) {
    const conditions = [eq(recoveryPlans.orgId, orgId)];
    if (filters.status) conditions.push(eq(recoveryPlans.status, filters.status));
    if (filters.recoveryType) conditions.push(eq(recoveryPlans.recoveryType, filters.recoveryType));
    if (filters.caseId) conditions.push(eq(recoveryPlans.caseId, filters.caseId));
    if (filters.baggageId) conditions.push(eq(recoveryPlans.baggageId, filters.baggageId));

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;

    const results = await db.select().from(recoveryPlans)
      .where(and(...conditions))
      .orderBy(desc(recoveryPlans.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const countResult = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text as count FROM recovery_plans WHERE org_id = ${orgId}`,
    );
    const total = parseInt(countResult[0]?.count ?? '0', 10);

    return { items: results, total, page, pageSize };
  }

  async updatePlan(planId: string, orgId: string, input: UpdateRecoveryPlanInput, userId: string) {
    const plan = await this.getPlan(planId, orgId);
    const setValues: Record<string, unknown> = {};
    if (input.recoveryType !== undefined) setValues['recoveryType'] = input.recoveryType;
    if (input.origin !== undefined) setValues['origin'] = input.origin;
    if (input.destination !== undefined) setValues['destination'] = input.destination;
    if (input.currentLocation !== undefined) setValues['currentLocation'] = input.currentLocation;
    if (input.metadata !== undefined) setValues['metadata'] = JSON.stringify(input.metadata);

    if (Object.keys(setValues).length === 0) return plan;

    const [updated] = await db.update(recoveryPlans)
      .set(setValues)
      .where(and(eq(recoveryPlans.id, planId), eq(recoveryPlans.orgId, orgId)))
      .returning();

    await auditLog({
      orgId,
      userId,
      action: 'recovery_plan_updated',
      entityType: 'recovery_plan',
      entityId: planId,
      entityRef: plan.planNumber,
      changes: JSON.stringify(input),
    });

    return updated!;
  }

  async transitionPlan(planId: string, orgId: string, newStatus: string, userId: string) {
    const plan = await this.getPlan(planId, orgId);
    const validTransitions = RECOVERY_PLAN_TRANSITIONS[plan.status];
    if (!validTransitions || !(validTransitions as readonly string[]).includes(newStatus)) {
      throw new Error(`Invalid transition from ${plan.status} to ${newStatus}`);
    }

    const [updated] = await db.update(recoveryPlans)
      .set({ status: newStatus })
      .where(and(eq(recoveryPlans.id, planId), eq(recoveryPlans.orgId, orgId)))
      .returning();

    await auditLog({
      orgId,
      userId,
      action: 'recovery_plan_transitioned',
      entityType: 'recovery_plan',
      entityId: planId,
      entityRef: plan.planNumber,
      changes: JSON.stringify({ from: plan.status, to: newStatus }),
    });

    logger.info({ planId, from: plan.status, to: newStatus }, 'Recovery plan transitioned');
    return updated!;
  }

  async approvePlan(planId: string, orgId: string, routeOptionId: string, userId: string) {
    const plan = await this.getPlan(planId, orgId);
    if (plan.status !== 'awaiting_approval') {
      throw new Error(`Cannot approve plan in status ${plan.status}`);
    }

    const [updated] = await db.update(recoveryPlans)
      .set({
        status: 'approved',
        selectedRouteOptionId: routeOptionId,
        approvedBy: userId,
        approvedAt: new Date(),
      })
      .where(and(eq(recoveryPlans.id, planId), eq(recoveryPlans.orgId, orgId)))
      .returning();

    await auditLog({
      orgId,
      userId,
      action: 'recovery_plan_approved',
      entityType: 'recovery_plan',
      entityId: planId,
      entityRef: plan.planNumber,
      changes: JSON.stringify({ routeOptionId }),
    });

    logger.info({ planId, routeOptionId }, 'Recovery plan approved');
    return updated!;
  }

  async rejectPlan(planId: string, orgId: string, userId: string) {
    return this.transitionPlan(planId, orgId, 'rejected', userId);
  }

  async cancelPlan(planId: string, orgId: string, userId: string) {
    return this.transitionPlan(planId, orgId, 'cancelled', userId);
  }

  async replan(planId: string, orgId: string, userId: string) {
    return this.transitionPlan(planId, orgId, 'replanning', userId);
  }

  async getRouteOptions(planId: string, orgId: string) {
    const plan = await this.getPlan(planId, orgId);
    return db.select().from(recoveryRouteOptions)
      .where(eq(recoveryRouteOptions.recoveryPlanId, plan.id))
      .orderBy(desc(recoveryRouteOptions.score));
  }

  async getRouteOption(routeOptionId: string, orgId: string) {
    const [option] = await db.select().from(recoveryRouteOptions)
      .where(and(eq(recoveryRouteOptions.id, routeOptionId), eq(recoveryRouteOptions.orgId, orgId)));
    if (!option) throw new Error('Route option not found');

    const segments = await db.select().from(recoveryRouteSegments)
      .where(eq(recoveryRouteSegments.routeOptionId, routeOptionId))
      .orderBy(asc(recoveryRouteSegments.segmentOrder));

    return { ...option, segments };
  }

  async updateRouteOptionScore(optionId: string, orgId: string, score: number, breakdown: Record<string, number>) {
    const [updated] = await db
      .update(recoveryRouteOptions)
      .set({
        score: String(score),
        scoreBreakdown: JSON.stringify(breakdown),
        updatedAt: new Date(),
      })
      .where(and(eq(recoveryRouteOptions.id, optionId), eq(recoveryRouteOptions.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Route option not found');
    }

    return updated;
  }

  async createRouteOption(planId: string, orgId: string, data: {
    optionLabel: string;
    totalEtaMinutes?: number;
    totalDistance?: number;
    segmentCount: number;
    riskLevel: string;
    slaCompliant: boolean;
    slaMarginMinutes?: number;
    estimatedCost?: number;
    score?: number;
    scoreBreakdown?: string;
  }) {
    const plan = await this.getPlan(planId, orgId);
    const [option] = await db.insert(recoveryRouteOptions).values({
      orgId,
      recoveryPlanId: plan.id,
      optionLabel: data.optionLabel,
      status: 'active',
      totalEtaMinutes: data.totalEtaMinutes ?? null,
      totalDistance: data.totalDistance ?? null,
      segmentCount: data.segmentCount,
      riskLevel: data.riskLevel,
      slaCompliant: data.slaCompliant,
      slaMarginMinutes: data.slaMarginMinutes ?? null,
      estimatedCost: data.estimatedCost != null ? String(data.estimatedCost) : null,
      score: data.score != null ? String(data.score) : null,
      scoreBreakdown: data.scoreBreakdown ?? null,
      rejectionReason: null,
      metadata: null,
    }).returning();
    return option!;
  }

  async addRouteSegment(routeOptionId: string, orgId: string, data: {
    segmentOrder: number;
    origin: string;
    destination: string;
    mode: string;
    carrier?: string;
    flightNumber?: string;
    flightId?: string;
    scheduledDeparture?: Date;
    scheduledArrival?: Date;
    estimatedDeparture?: Date;
    estimatedArrival?: Date;
    durationMinutes?: number;
    connectionMinutes?: number;
    cost?: number;
    riskLevel?: string;
    notes?: string;
  }) {
    const [segment] = await db.insert(recoveryRouteSegments).values({
      orgId,
      routeOptionId,
      segmentOrder: data.segmentOrder,
      origin: data.origin,
      destination: data.destination,
      mode: data.mode,
      carrier: data.carrier ?? null,
      flightNumber: data.flightNumber ?? null,
      flightId: data.flightId ?? null,
      scheduledDeparture: data.scheduledDeparture ?? null,
      scheduledArrival: data.scheduledArrival ?? null,
      estimatedDeparture: data.estimatedDeparture ?? null,
      estimatedArrival: data.estimatedArrival ?? null,
      durationMinutes: data.durationMinutes ?? null,
      connectionMinutes: data.connectionMinutes ?? null,
      status: 'planned',
      providerId: null,
      providerServiceId: null,
      cost: data.cost != null ? String(data.cost) : null,
      riskLevel: data.riskLevel ?? null,
      notes: data.notes ?? null,
      metadata: null,
    }).returning();
    return segment!;
  }

  async createVersion(planId: string, orgId: string, routeOptionId: string, changeReason: string, snapshot: Record<string, unknown>, userId: string) {
    const versionCount = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text as count FROM recovery_plan_versions WHERE recovery_plan_id = ${planId}`,
    );
    const versionNumber = parseInt(versionCount[0]?.count ?? '0', 10) + 1;

    const [version] = await db.insert(recoveryPlanVersions).values({
      orgId,
      recoveryPlanId: planId,
      versionNumber,
      routeOptionId,
      changeReason,
      snapshot: JSON.stringify(snapshot),
      createdBy: userId,
    }).returning();

    await auditLog({
      orgId,
      userId,
      action: 'recovery_plan_version_created',
      entityType: 'recovery_plan_version',
      entityId: version!.id,
      changes: JSON.stringify({ planId, versionNumber, changeReason }),
    });

    return version!;
  }

  async getVersions(planId: string, orgId: string) {
    return db.select().from(recoveryPlanVersions)
      .where(and(eq(recoveryPlanVersions.recoveryPlanId, planId), eq(recoveryPlanVersions.orgId, orgId)))
      .orderBy(desc(recoveryPlanVersions.versionNumber));
  }
}

export const recoveryService = new RecoveryService();
