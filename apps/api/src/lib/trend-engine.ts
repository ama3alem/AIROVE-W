import { eq, and, sql, gte, lte, asc } from 'drizzle-orm';
import { db, analyticsSnapshots } from '@airove/db';
import type {
  TrendDataPoint,
  TrendResult,
  AnalyticsTimeRange,
  AnalyticsGranularity,
} from '@airove/shared';
import { metricEngineService, resolveTimeRangeBounds } from './metric-engine';

export const trendEngineService = {
  async getTrend(
    orgId: string,
    metricName: string,
    timeRange: AnalyticsTimeRange,
    granularity: AnalyticsGranularity,
    customFrom?: string,
    customTo?: string,
  ): Promise<TrendResult | null> {
    const def = await metricEngineService.getMetricDefinition(orgId, metricName);
    if (!def) return null;

    const bounds = resolveTimeRangeBounds(timeRange, customFrom, customTo);
    const durationMs = bounds.to.getTime() - bounds.from.getTime();
    const prevFrom = new Date(bounds.from.getTime() - durationMs);
    const prevTo = bounds.from;

    const currentRows = await db
      .select({
        periodFrom: analyticsSnapshots.periodFrom,
        value: sql<number>`sum(${analyticsSnapshots.value})::int`,
      })
      .from(analyticsSnapshots)
      .where(
        and(
          eq(analyticsSnapshots.orgId, orgId),
          eq(analyticsSnapshots.metricName, metricName),
          eq(analyticsSnapshots.granularity, granularity),
          gte(analyticsSnapshots.periodFrom, bounds.from),
          lte(analyticsSnapshots.periodTo, bounds.to),
        ),
      )
      .groupBy(analyticsSnapshots.periodFrom)
      .orderBy(asc(analyticsSnapshots.periodFrom));

    const previousRows = await db
      .select({
        periodFrom: analyticsSnapshots.periodFrom,
        value: sql<number>`sum(${analyticsSnapshots.value})::int`,
      })
      .from(analyticsSnapshots)
      .where(
        and(
          eq(analyticsSnapshots.orgId, orgId),
          eq(analyticsSnapshots.metricName, metricName),
          eq(analyticsSnapshots.granularity, granularity),
          gte(analyticsSnapshots.periodFrom, prevFrom),
          lte(analyticsSnapshots.periodTo, prevTo),
        ),
      )
      .groupBy(analyticsSnapshots.periodFrom)
      .orderBy(asc(analyticsSnapshots.periodFrom));

    const currentPoints: TrendDataPoint[] = currentRows.map((r) => ({
      timestamp: r.periodFrom,
      value: r.value,
    }));

    const previousPoints: TrendDataPoint[] = previousRows.map((r) => ({
      timestamp: r.periodFrom,
      value: r.value,
    }));

    const currentTotal = currentPoints.reduce((sum, p) => sum + p.value, 0);
    const previousTotal = previousPoints.reduce((sum, p) => sum + p.value, 0);
    const absoluteChange = currentTotal - previousTotal;
    const percentageChange =
      previousTotal !== 0
        ? Math.round(((currentTotal - previousTotal) / Math.abs(previousTotal)) * 10000) / 100
        : 0;

    return {
      metric: metricName,
      current: currentPoints,
      previous: previousPoints,
      summary: {
        currentValue: currentTotal,
        previousValue: previousTotal,
        absoluteChange,
        percentageChange,
      },
    };
  },

  async getMultipleTrends(
    orgId: string,
    metricNames: string[],
    timeRange: AnalyticsTimeRange,
    granularity: AnalyticsGranularity,
    customFrom?: string,
    customTo?: string,
  ): Promise<TrendResult[]> {
    const results: TrendResult[] = [];

    for (const name of metricNames) {
      const trend = await this.getTrend(
        orgId,
        name,
        timeRange,
        granularity,
        customFrom,
        customTo,
      );
      if (trend) {
        results.push(trend);
      }
    }

    return results;
  },

  async detectAnomalies(
    orgId: string,
    metricName: string,
    timeRange: AnalyticsTimeRange,
    granularity: AnalyticsGranularity,
    customFrom?: string,
    customTo?: string,
  ): Promise<{ timestamp: Date; value: number; expectedValue: number; deviation: number }[]> {
    const trend = await this.getTrend(
      orgId,
      metricName,
      timeRange,
      granularity,
      customFrom,
      customTo,
    );

    if (!trend || trend.current.length === 0) return [];

    const values = trend.current.map((p) => p.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return [];

    const anomalies: { timestamp: Date; value: number; expectedValue: number; deviation: number }[] = [];

    for (const point of trend.current) {
      const deviation = (point.value - mean) / stdDev;
      if (Math.abs(deviation) > 2) {
        anomalies.push({
          timestamp: point.timestamp,
          value: point.value,
          expectedValue: Math.round(mean),
          deviation: Math.round(deviation * 100) / 100,
        });
      }
    }

    return anomalies;
  },
};
