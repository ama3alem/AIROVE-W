import { eq, and, sql, gte, lte } from 'drizzle-orm';
import {
  db,
  baggage,
  baggageEvents,
  cases,
  recoveryPlans,
  recoveryRouteOptions,
  recoveryProviders,
  recoveryProviderAssignments,
} from '@airove/db';
import type {
  CaseAnalyticsSummary,
  RecoveryAnalyticsSummary,
  RouteAnalyticsSummary,
  ProviderAnalyticsSummary,
  AnalyticsTimeRange,
} from '@airove/shared';
import { resolveTimeRangeBounds } from './metric-engine.js';

export const baggageAnalyticsService = {
  async getAgingDistribution(
    orgId: string,
    airportCode?: string,
  ): Promise<{ label: string; count: number }[]> {
    const now = new Date();

    const conditions = [
      eq(baggage.orgId, orgId),
      eq(baggage.status, 'in_transit'),
    ];

    if (airportCode) {
      conditions.push(eq(baggage.currentLocation, airportCode));
    }

    const rows = await db
      .select({
        createdAt: baggage.createdAt,
      })
      .from(baggage)
      .where(and(...conditions));

    const buckets = [
      { label: '< 1h', minMinutes: 0, maxMinutes: 60 },
      { label: '1-4h', minMinutes: 60, maxMinutes: 240 },
      { label: '4-12h', minMinutes: 240, maxMinutes: 720 },
      { label: '12-24h', minMinutes: 720, maxMinutes: 1440 },
      { label: '24h+', minMinutes: 1440, maxMinutes: Infinity },
    ];

    const distribution = buckets.map((b) => ({ label: b.label, count: 0 }));

    for (const row of rows) {
      const ageMs = now.getTime() - row.createdAt.getTime();
      const ageMinutes = ageMs / 60000;

      const bucket = buckets.find(
        (b) => ageMinutes >= b.minMinutes && ageMinutes < b.maxMinutes,
      );
      if (!bucket) continue;
      const slot = distribution.find((d) => d.label === bucket.label);
      if (slot) slot.count++;
    }

    return distribution;
  },

  async getEventsByType(
    orgId: string,
    timeRange: AnalyticsTimeRange,
    customFrom?: string,
    customTo?: string,
  ): Promise<Record<string, number>> {
    const bounds = resolveTimeRangeBounds(timeRange, customFrom, customTo);

    const rows = await db
      .select({
        eventType: baggageEvents.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(baggageEvents)
      .innerJoin(baggage, eq(baggageEvents.baggageId, baggage.id))
      .where(
        and(
          eq(baggage.orgId, orgId),
          gte(baggageEvents.createdAt, bounds.from),
          lte(baggageEvents.createdAt, bounds.to),
        ),
      )
      .groupBy(baggageEvents.eventType);

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.eventType] = row.count;
    }
    return result;
  },
};

export const caseAnalyticsService = {
  async getSummary(
    orgId: string,
    timeRange: AnalyticsTimeRange,
    filters?: Record<string, string>,
    customFrom?: string,
    customTo?: string,
  ): Promise<CaseAnalyticsSummary> {
    const bounds = resolveTimeRangeBounds(timeRange, customFrom, customTo);

    const conditions = [
      eq(cases.orgId, orgId),
      gte(cases.createdAt, bounds.from),
      lte(cases.createdAt, bounds.to),
    ];

    if (filters?.['caseType']) {
      conditions.push(eq(cases.caseType, filters['caseType']));
    }
    if (filters?.['priority']) {
      conditions.push(eq(cases.priority, filters['priority']));
    }

    const totalCases = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cases)
      .where(and(...conditions));

    const statusRows = await db
      .select({
        status: cases.status,
        count: sql<number>`count(*)::int`,
      })
      .from(cases)
      .where(and(...conditions))
      .groupBy(cases.status);

    const typeRows = await db
      .select({
        caseType: cases.caseType,
        count: sql<number>`count(*)::int`,
      })
      .from(cases)
      .where(and(...conditions))
      .groupBy(cases.caseType);

    const priorityRows = await db
      .select({
        priority: cases.priority,
        count: sql<number>`count(*)::int`,
      })
      .from(cases)
      .where(and(...conditions))
      .groupBy(cases.priority);

    const statusCounts: Record<string, number> = {};
    for (const row of statusRows) {
      statusCounts[row.status] = row.count;
    }

    const typeCounts: Record<string, number> = {};
    for (const row of typeRows) {
      typeCounts[row.caseType] = row.count;
    }

    const priorityCounts: Record<string, number> = {};
    for (const row of priorityRows) {
      priorityCounts[row.priority] = row.count;
    }

    return {
      totalCases: totalCases[0]?.count ?? 0,
      openCases: statusCounts['open'] ?? 0,
      closedCases: statusCounts['closed'] ?? 0,
      casesByType: typeCounts,
      casesByPriority: priorityCounts,
      casesByStatus: statusCounts,
      averageResolutionMinutes: null,
      slaComplianceRate: 0,
      agingDistribution: [],
    };
  },
};

export const recoveryAnalyticsService = {
  async getSummary(
    orgId: string,
    timeRange: AnalyticsTimeRange,
    filters?: Record<string, string>,
    customFrom?: string,
    customTo?: string,
  ): Promise<RecoveryAnalyticsSummary> {
    const bounds = resolveTimeRangeBounds(timeRange, customFrom, customTo);

    const conditions = [
      eq(recoveryPlans.orgId, orgId),
      gte(recoveryPlans.createdAt, bounds.from),
      lte(recoveryPlans.createdAt, bounds.to),
    ];

    if (filters?.['recoveryType']) {
      conditions.push(eq(recoveryPlans.recoveryType, filters['recoveryType']));
    }

    const totalPlans = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(recoveryPlans)
      .where(and(...conditions));

    const statusRows = await db
      .select({
        status: recoveryPlans.status,
        count: sql<number>`count(*)::int`,
      })
      .from(recoveryPlans)
      .where(and(...conditions))
      .groupBy(recoveryPlans.status);

    const typeRows = await db
      .select({
        recoveryType: recoveryPlans.recoveryType,
        count: sql<number>`count(*)::int`,
      })
      .from(recoveryPlans)
      .where(and(...conditions))
      .groupBy(recoveryPlans.recoveryType);

    const statusCounts: Record<string, number> = {};
    for (const row of statusRows) {
      statusCounts[row.status] = row.count;
    }

    const typeCounts: Record<string, number> = {};
    for (const row of typeRows) {
      typeCounts[row.recoveryType] = row.count;
    }

    const total = totalPlans[0]?.count ?? 0;
    const completed = statusCounts['completed'] ?? 0;
    const failed = statusCounts['failed'] ?? 0;
    const active = (statusCounts['in_progress'] ?? 0) + (statusCounts['scheduled'] ?? 0);

    return {
      totalPlans: total,
      activePlans: active,
      completedPlans: completed,
      failedPlans: failed,
      averageRecoveryMinutes: null,
      slaComplianceRate: 0,
      successRate: total > 0 ? Math.round((completed / total) * 10000) / 100 : 0,
      plansByType: typeCounts,
    };
  },
};

export const routeAnalyticsService = {
  async getSummary(
    orgId: string,
    timeRange: AnalyticsTimeRange,
    customFrom?: string,
    customTo?: string,
  ): Promise<RouteAnalyticsSummary> {
    const bounds = resolveTimeRangeBounds(timeRange, customFrom, customTo);

    const planIds = await db
      .select({ id: recoveryPlans.id })
      .from(recoveryPlans)
      .where(
        and(
          eq(recoveryPlans.orgId, orgId),
          gte(recoveryPlans.createdAt, bounds.from),
          lte(recoveryPlans.createdAt, bounds.to),
        ),
      );

    if (planIds.length === 0) {
      return {
        totalRoutes: 0,
        averageScore: 0,
        averageEta: null,
        slaComplianceRate: 0,
        riskDistribution: {},
        constraintFailureRate: 0,
        successRate: 0,
      };
    }

    const planIdList = planIds.map((p) => p.id);

    const routeRows = await db
      .select({
        score: sql<number>`avg(${recoveryRouteOptions.score})::int`,
        totalEta: sql<number>`avg(${recoveryRouteOptions.totalEtaMinutes})::int`,
        slaCompliant: recoveryRouteOptions.slaCompliant,
        riskLevel: recoveryRouteOptions.riskLevel,
        count: sql<number>`count(*)::int`,
      })
      .from(recoveryRouteOptions)
      .where(
        sql`${recoveryRouteOptions.recoveryPlanId} in ${planIdList}`,
      )
      .groupBy(recoveryRouteOptions.slaCompliant, recoveryRouteOptions.riskLevel);

    let totalRoutes = 0;
    let totalScore = 0;
    let totalEta = 0;
    let slaCompliantCount = 0;
    const riskDistribution: Record<string, number> = {};

    for (const row of routeRows) {
      totalRoutes += row.count;
      totalScore += (row.score ?? 0) * row.count;
      totalEta += (row.totalEta ?? 0) * row.count;
      if (row.slaCompliant) slaCompliantCount += row.count;
      if (row.riskLevel) {
        riskDistribution[row.riskLevel] = (riskDistribution[row.riskLevel] ?? 0) + row.count;
      }
    }

    return {
      totalRoutes,
      averageScore: totalRoutes > 0 ? Math.round(totalScore / totalRoutes) : 0,
      averageEta: totalRoutes > 0 ? Math.round(totalEta / totalRoutes) : null,
      slaComplianceRate:
        totalRoutes > 0 ? Math.round((slaCompliantCount / totalRoutes) * 10000) / 100 : 0,
      riskDistribution,
      constraintFailureRate: 0,
      successRate: 0,
    };
  },
};

export const providerAnalyticsService = {
  async getSummary(
    orgId: string,
    timeRange: AnalyticsTimeRange,
    customFrom?: string,
    customTo?: string,
  ): Promise<ProviderAnalyticsSummary> {
    const bounds = resolveTimeRangeBounds(timeRange, customFrom, customTo);

    const providerRows = await db
      .select({
        id: recoveryProviders.id,
        status: recoveryProviders.status,
      })
      .from(recoveryProviders)
      .where(eq(recoveryProviders.orgId, orgId));

    const totalProviders = providerRows.length;
    const activeProviders = providerRows.filter((r) => r.status === 'active').length;

    const assignmentRows = await db
      .select({
        status: recoveryProviderAssignments.status,
        count: sql<number>`count(*)::int`,
      })
      .from(recoveryProviderAssignments)
      .innerJoin(
        recoveryProviders,
        eq(recoveryProviderAssignments.providerId, recoveryProviders.id),
      )
      .where(
        and(
          eq(recoveryProviders.orgId, orgId),
          gte(recoveryProviderAssignments.createdAt, bounds.from),
          lte(recoveryProviderAssignments.createdAt, bounds.to),
        ),
      )
      .groupBy(recoveryProviderAssignments.status);

    let totalAssignments = 0;
    let completedCount = 0;
    let failedCount = 0;

    for (const row of assignmentRows) {
      totalAssignments += row.count;
      if (row.status === 'completed') completedCount += row.count;
      if (row.status === 'failed') failedCount += row.count;
    }

    return {
      totalProviders,
      activeProviders,
      totalAssignments,
      completionRate:
        totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 10000) / 100 : 0,
      failureRate:
        totalAssignments > 0 ? Math.round((failedCount / totalAssignments) * 10000) / 100 : 0,
      averageCompletionMinutes: null,
      slaComplianceRate: 0,
    };
  },
};
