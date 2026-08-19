import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';
import { db, analyticsDefinitions, analyticsSnapshots } from '@airove/db';
import type {
  MetricDefinition,
  AnalyticsSnapshot,
  MetricValue,
  AnalyticsTimeRange,
  AnalyticsGranularity,
} from '@airove/shared';
function mapMetricDefinition(r: typeof analyticsDefinitions.$inferSelect): MetricDefinition {
  return {
    id: r.id,
    orgId: r.orgId,
    metricName: r.metricName,
    displayName: r.displayName,
    description: r.description ?? '',
    category: r.category as MetricDefinition['category'],
    aggregationType: r.aggregationType as MetricDefinition['aggregationType'],
    supportedDimensions: (r.supportedDimensions ?? []) as MetricDefinition['supportedDimensions'],
    unit: r.unit,
    isActive: r.isActive,
    version: r.version,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapSnapshot(r: typeof analyticsSnapshots.$inferSelect): AnalyticsSnapshot {
  return {
    id: r.id,
    orgId: r.orgId,
    metricName: r.metricName,
    dimensions: (r.dimensions ?? {}) as Record<string, string>,
    value: r.value,
    previousValue: r.previousValue,
    absoluteChange: r.absoluteChange,
    percentageChange: r.percentageChange,
    periodFrom: r.periodFrom,
    periodTo: r.periodTo,
    granularity: r.granularity as AnalyticsGranularity,
    createdAt: r.createdAt,
  };
}

export function resolveTimeRangeBounds(
  timeRange: AnalyticsTimeRange,
  customFrom?: string,
  customTo?: string,
): { from: Date; to: Date } {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  switch (timeRange) {
    case 'today':
      return { from: startOfDay, to: now };
    case 'yesterday': {
      const yesterday = new Date(startOfDay);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: yesterday, to: startOfDay };
    }
    case 'last_7_days': {
      const d = new Date(startOfDay);
      d.setDate(d.getDate() - 7);
      return { from: d, to: now };
    }
    case 'last_30_days': {
      const d = new Date(startOfDay);
      d.setDate(d.getDate() - 30);
      return { from: d, to: now };
    }
    case 'last_90_days': {
      const d = new Date(startOfDay);
      d.setDate(d.getDate() - 90);
      return { from: d, to: now };
    }
    case 'custom_range':
      return {
        from: customFrom ? new Date(customFrom) : startOfDay,
        to: customTo ? new Date(customTo) : now,
      };
    default:
      return { from: startOfDay, to: now };
  }
}

function resolvePreviousBounds(
  timeRange: AnalyticsTimeRange,
  from: Date,
  to: Date,
): { from: Date; to: Date } {
  const durationMs = to.getTime() - from.getTime();
  return {
    from: new Date(from.getTime() - durationMs),
    to: from,
  };
}

export const metricEngineService = {
  async getMetricDefinition(
    orgId: string,
    metricName: string,
  ): Promise<MetricDefinition | null> {
    const rows = await db
      .select()
      .from(analyticsDefinitions)
      .where(
        and(
          eq(analyticsDefinitions.orgId, orgId),
          eq(analyticsDefinitions.metricName, metricName),
          eq(analyticsDefinitions.isActive, true),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    const r = rows[0];
    if (!r) return null;
    return mapMetricDefinition(r);
  },

  async listMetricDefinitions(
    orgId: string,
    category?: string,
  ): Promise<MetricDefinition[]> {
    const conditions = [
      eq(analyticsDefinitions.orgId, orgId),
      eq(analyticsDefinitions.isActive, true),
    ];
    if (category) {
      conditions.push(eq(analyticsDefinitions.category, category));
    }

    const rows = await db
      .select()
      .from(analyticsDefinitions)
      .where(and(...conditions));

    return rows.map(mapMetricDefinition);
  },

  async upsertMetricDefinition(
    orgId: string,
    data: {
      metricName: string;
      displayName: string;
      description: string;
      category: string;
      aggregationType: string;
      supportedDimensions: string[];
      unit: string;
    },
  ): Promise<MetricDefinition> {
    const existing = await this.getMetricDefinition(orgId, data.metricName);

    if (existing) {
      const rows = await db
        .update(analyticsDefinitions)
        .set({
          displayName: data.displayName,
          description: data.description,
          category: data.category,
          aggregationType: data.aggregationType,
          supportedDimensions: data.supportedDimensions,
          unit: data.unit,
          version: existing.version + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(analyticsDefinitions.orgId, orgId),
            eq(analyticsDefinitions.metricName, data.metricName),
          ),
        )
        .returning();

      const r = rows[0];
      if (!r) throw new Error('Failed to update metric definition');
      return mapMetricDefinition(r);
    }

    const rows = await db
      .insert(analyticsDefinitions)
      .values({
        orgId,
        metricName: data.metricName,
        displayName: data.displayName,
        description: data.description,
        category: data.category,
        aggregationType: data.aggregationType,
        supportedDimensions: data.supportedDimensions,
        unit: data.unit,
      })
      .returning();

    const r = rows[0];
    if (!r) throw new Error('Failed to create metric definition');
    return mapMetricDefinition(r);
  },

  async getSnapshots(
    orgId: string,
    metricName: string,
    timeRange: AnalyticsTimeRange,
    granularity: AnalyticsGranularity,
    filters?: Record<string, string>,
    customFrom?: string,
    customTo?: string,
  ): Promise<AnalyticsSnapshot[]> {
    const bounds = resolveTimeRangeBounds(timeRange, customFrom, customTo);

    const conditions = [
      eq(analyticsSnapshots.orgId, orgId),
      eq(analyticsSnapshots.metricName, metricName),
      eq(analyticsSnapshots.granularity, granularity),
      gte(analyticsSnapshots.periodFrom, bounds.from),
      lte(analyticsSnapshots.periodTo, bounds.to),
    ];

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (key && value) {
          conditions.push(
            sql`${analyticsSnapshots.dimensions} ->> ${key} = ${value}`,
          );
        }
      }
    }

    const rows = await db
      .select()
      .from(analyticsSnapshots)
      .where(and(...conditions))
      .orderBy(desc(analyticsSnapshots.periodFrom));

    return rows.map(mapSnapshot);
  },

  async getMetricValue(
    orgId: string,
    metricName: string,
    timeRange: AnalyticsTimeRange,
    scope: Record<string, string>,
    customFrom?: string,
    customTo?: string,
  ): Promise<MetricValue | null> {
    const def = await this.getMetricDefinition(orgId, metricName);
    if (!def) return null;

    const bounds = resolveTimeRangeBounds(timeRange, customFrom, customTo);
    const prevBounds = resolvePreviousBounds(timeRange, bounds.from, bounds.to);

    const currentRows = await this.getSnapshots(
      orgId,
      metricName,
      timeRange,
      'day',
      scope,
      customFrom,
      customTo,
    );

    if (currentRows.length === 0) return null;

    const currentValue = currentRows.reduce((sum, r) => sum + r.value, 0);
    const prevRows = await db
      .select()
      .from(analyticsSnapshots)
      .where(
        and(
          eq(analyticsSnapshots.orgId, orgId),
          eq(analyticsSnapshots.metricName, metricName),
          gte(analyticsSnapshots.periodFrom, prevBounds.from),
          lte(analyticsSnapshots.periodTo, prevBounds.to),
        ),
      );

    const prevValue = prevRows.reduce((sum, r) => sum + r.value, 0);
    const absoluteChange = currentValue - prevValue;
    const percentageChange =
      prevValue !== 0
        ? Math.round(((currentValue - prevValue) / Math.abs(prevValue)) * 10000) / 100
        : null;

    return {
      metric: metricName,
      value: currentValue,
      unit: def.unit,
      period: bounds,
      scope,
      comparison:
        prevValue !== 0
          ? {
              previousValue: prevValue,
              absoluteChange,
              percentageChange: percentageChange!,
            }
          : undefined,
    };
  },

  async upsertSnapshot(
    orgId: string,
    data: {
      metricName: string;
      dimensions: Record<string, string>;
      value: number;
      periodFrom: Date;
      periodTo: Date;
      granularity: string;
    },
  ): Promise<AnalyticsSnapshot> {
    const existing = await db
      .select()
      .from(analyticsSnapshots)
      .where(
        and(
          eq(analyticsSnapshots.orgId, orgId),
          eq(analyticsSnapshots.metricName, data.metricName),
          eq(analyticsSnapshots.granularity, data.granularity),
          sql`${analyticsSnapshots.dimensions} = ${JSON.stringify(data.dimensions)}`,
          eq(analyticsSnapshots.periodFrom, data.periodFrom),
        ),
      )
      .limit(1);

    let rows: typeof existing;

    if (existing.length > 0) {
      const existingRow = existing[0];
      if (!existingRow) throw new Error('Failed to upsert snapshot');
      rows = await db
        .update(analyticsSnapshots)
        .set({ value: data.value })
        .where(eq(analyticsSnapshots.id, existingRow.id))
        .returning();
    } else {
      rows = await db
        .insert(analyticsSnapshots)
        .values({
          orgId,
          metricName: data.metricName,
          dimensions: data.dimensions,
          value: data.value,
          periodFrom: data.periodFrom,
          periodTo: data.periodTo,
          granularity: data.granularity,
        })
        .returning();
    }

    const r = rows[0];
    if (!r) throw new Error('Failed to upsert snapshot');
    return mapSnapshot(r);
  },
};
