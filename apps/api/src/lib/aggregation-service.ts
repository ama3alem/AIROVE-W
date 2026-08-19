import { eq, and, sql, gte, lte } from 'drizzle-orm';
import {
  db,
  recoveryPlans,
  cases,
  baggage,
  baggageEvents,
  recoveryProviders,
  recoveryProviderAssignments,
  caseSla,
} from '@airove/db';
import type {
  AnalyticsTimeRange,
} from '@airove/shared';
import { resolveTimeRangeBounds } from './metric-engine.js';

export interface AggregationResult {
  metric: string;
  value: number;
  count?: number;
  dimensions?: Record<string, string>;
}

export const aggregationService = {
  async aggregateBaggageMetrics(
    orgId: string,
    timeRange: AnalyticsTimeRange,
    filters?: Record<string, string>,
    customFrom?: string,
    customTo?: string,
  ): Promise<AggregationResult[]> {
    const bounds = resolveTimeRangeBounds(timeRange, customFrom, customTo);

    const conditions = [
      eq(baggage.orgId, orgId),
      gte(baggage.createdAt, bounds.from),
      lte(baggage.createdAt, bounds.to),
    ];

    if (filters?.['airportCode']) {
      conditions.push(eq(baggage.currentLocation, filters['airportCode']));
    }

    const rows = await db
      .select({
        status: baggage.status,
        count: sql<number>`count(*)::int`,
      })
      .from(baggage)
      .where(and(...conditions))
      .groupBy(baggage.status);

    return rows.map((r) => ({
      metric: `baggage_by_status_${r.status}`,
      value: r.count,
      count: r.count,
    }));
  },

  async aggregateCaseMetrics(
    orgId: string,
    timeRange: AnalyticsTimeRange,
    filters?: Record<string, string>,
    customFrom?: string,
    customTo?: string,
  ): Promise<AggregationResult[]> {
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

    const rows = await db
      .select({
        status: cases.status,
        count: sql<number>`count(*)::int`,
      })
      .from(cases)
      .where(and(...conditions))
      .groupBy(cases.status);

    return rows.map((r) => ({
      metric: `cases_by_status_${r.status}`,
      value: r.count,
      count: r.count,
    }));
  },

  async aggregateRecoveryMetrics(
    orgId: string,
    timeRange: AnalyticsTimeRange,
    filters?: Record<string, string>,
    customFrom?: string,
    customTo?: string,
  ): Promise<AggregationResult[]> {
    const bounds = resolveTimeRangeBounds(timeRange, customFrom, customTo);

    const conditions = [
      eq(recoveryPlans.orgId, orgId),
      gte(recoveryPlans.createdAt, bounds.from),
      lte(recoveryPlans.createdAt, bounds.to),
    ];

    if (filters?.['recoveryType']) {
      conditions.push(eq(recoveryPlans.recoveryType, filters['recoveryType']));
    }

    const rows = await db
      .select({
        status: recoveryPlans.status,
        count: sql<number>`count(*)::int`,
      })
      .from(recoveryPlans)
      .where(and(...conditions))
      .groupBy(recoveryPlans.status);

    return rows.map((r) => ({
      metric: `recovery_by_status_${r.status}`,
      value: r.count,
      count: r.count,
    }));
  },

  async aggregateProviderMetrics(
    orgId: string,
    timeRange: AnalyticsTimeRange,
    customFrom?: string,
    customTo?: string,
  ): Promise<AggregationResult[]> {
    const bounds = resolveTimeRangeBounds(timeRange, customFrom, customTo);

    const assignmentRows = await db
      .select({
        providerId: recoveryProviderAssignments.providerId,
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
      .groupBy(recoveryProviderAssignments.providerId, recoveryProviderAssignments.status);

    const results: AggregationResult[] = [];

    for (const row of assignmentRows) {
      results.push({
        metric: `provider_${row.providerId}_assignments_${row.status}`,
        value: row.count,
        count: row.count,
        dimensions: { providerId: row.providerId, status: row.status },
      });
    }

    return results;
  },

  async aggregateSLAMetrics(
    orgId: string,
    timeRange: AnalyticsTimeRange,
    customFrom?: string,
    customTo?: string,
  ): Promise<AggregationResult[]> {
    const bounds = resolveTimeRangeBounds(timeRange, customFrom, customTo);

    const slaRows = await db
      .select({
        status: caseSla.status,
        count: sql<number>`count(*)::int`,
      })
      .from(caseSla)
      .innerJoin(cases, eq(caseSla.caseId, cases.id))
      .where(
        and(
          eq(cases.orgId, orgId),
          gte(caseSla.createdAt, bounds.from),
          lte(caseSla.createdAt, bounds.to),
        ),
      )
      .groupBy(caseSla.status);

    return slaRows.map((r) => ({
      metric: `sla_by_status_${r.status}`,
      value: r.count,
      count: r.count,
    }));
  },

  async aggregateEventMetrics(
    orgId: string,
    timeRange: AnalyticsTimeRange,
    customFrom?: string,
    customTo?: string,
  ): Promise<AggregationResult[]> {
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

    return rows.map((r) => ({
      metric: `events_by_type_${r.eventType}`,
      value: r.count,
      count: r.count,
    }));
  },
};
