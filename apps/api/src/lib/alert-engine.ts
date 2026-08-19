import { eq, and, sql, gte, desc, lte } from 'drizzle-orm';
import { db, analyticsAlertRules, analyticsAlerts, analyticsSnapshots } from '@airove/db';
import type {
  AnalyticsAlert,
  AnalyticsAlertRule,
  AlertSeverity,
  AlertStatus,
} from '@airove/shared';
import { ALERT_COOLDOWN_MINUTES } from '@airove/shared';

function mapAlertRule(r: typeof analyticsAlertRules.$inferSelect): AnalyticsAlertRule {
  return {
    id: r.id,
    orgId: r.orgId,
    ruleName: r.ruleName,
    metricName: r.metricName,
    condition: r.condition,
    threshold: r.threshold,
    severity: r.severity as AlertSeverity,
    scopeDimensions: (r.scopeDimensions ?? {}) as Record<string, string>,
    cooldownMinutes: r.cooldownMinutes,
    isActive: r.isActive,
    createdBy: r.createdBy ?? '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapAlert(r: typeof analyticsAlerts.$inferSelect): AnalyticsAlert {
  return {
    id: r.id,
    orgId: r.orgId,
    ruleId: r.ruleId,
    ruleName: r.ruleName,
    metricName: r.metricName,
    severity: r.severity as AlertSeverity,
    status: r.status as AlertStatus,
    actualValue: r.actualValue,
    threshold: r.threshold,
    scopeDimensions: (r.scopeDimensions ?? {}) as Record<string, string>,
    message: r.message ?? '',
    acknowledgedBy: r.acknowledgedBy,
    acknowledgedAt: r.acknowledgedAt,
    resolvedAt: r.resolvedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export const alertEngineService = {
  async listAlertRules(
    orgId: string,
    metricName?: string,
  ): Promise<AnalyticsAlertRule[]> {
    const conditions = [eq(analyticsAlertRules.orgId, orgId)];

    if (metricName) {
      conditions.push(eq(analyticsAlertRules.metricName, metricName));
    }

    const rows = await db
      .select()
      .from(analyticsAlertRules)
      .where(and(...conditions));

    return rows.map(mapAlertRule);
  },

  async createAlertRule(
    orgId: string,
    data: {
      ruleName: string;
      metricName: string;
      condition: string;
      threshold: number;
      severity: AlertSeverity;
      scopeDimensions?: Record<string, string>;
      cooldownMinutes?: number;
      createdBy: string;
    },
  ): Promise<AnalyticsAlertRule> {
    const rows = await db
      .insert(analyticsAlertRules)
      .values({
        orgId,
        ruleName: data.ruleName,
        metricName: data.metricName,
        condition: data.condition,
        threshold: data.threshold,
        severity: data.severity,
        scopeDimensions: data.scopeDimensions ?? {},
        cooldownMinutes: data.cooldownMinutes ?? ALERT_COOLDOWN_MINUTES,
        createdBy: data.createdBy,
      })
      .returning();

    const r = rows[0];
    if (!r) throw new Error('Failed to create alert rule');
    return mapAlertRule(r);
  },

  async updateAlertRule(
    orgId: string,
    ruleId: string,
    data: {
      ruleName?: string;
      metricName?: string;
      condition?: string;
      threshold?: number;
      severity?: AlertSeverity;
      scopeDimensions?: Record<string, string>;
      cooldownMinutes?: number;
      isActive?: boolean;
    },
  ): Promise<AnalyticsAlertRule | null> {
    const existing = await db
      .select()
      .from(analyticsAlertRules)
      .where(
        and(
          eq(analyticsAlertRules.id, ruleId),
          eq(analyticsAlertRules.orgId, orgId),
        ),
      )
      .limit(1);

    if (existing.length === 0) return null;

    const updateData: Partial<typeof analyticsAlertRules.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.ruleName !== undefined) updateData.ruleName = data.ruleName;
    if (data.metricName !== undefined) updateData.metricName = data.metricName;
    if (data.condition !== undefined) updateData.condition = data.condition;
    if (data.threshold !== undefined) updateData.threshold = data.threshold;
    if (data.severity !== undefined) updateData.severity = data.severity;
    if (data.scopeDimensions !== undefined) updateData.scopeDimensions = data.scopeDimensions;
    if (data.cooldownMinutes !== undefined) updateData.cooldownMinutes = data.cooldownMinutes;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const rows = await db
      .update(analyticsAlertRules)
      .set(updateData)
      .where(eq(analyticsAlertRules.id, ruleId))
      .returning();

    const r = rows[0];
    if (!r) return null;
    return mapAlertRule(r);
  },

  async deleteAlertRule(
    orgId: string,
    ruleId: string,
  ): Promise<boolean> {
    const deleted = await db
      .delete(analyticsAlertRules)
      .where(
        and(
          eq(analyticsAlertRules.id, ruleId),
          eq(analyticsAlertRules.orgId, orgId),
        ),
      )
      .returning({ id: analyticsAlertRules.id });

    return deleted.length > 0;
  },

  async listAlerts(
    orgId: string,
    filters?: {
      status?: AlertStatus;
      severity?: AlertSeverity;
      metricName?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{ alerts: AnalyticsAlert[]; total: number }> {
    const conditions = [eq(analyticsAlerts.orgId, orgId)];

    if (filters?.status) {
      conditions.push(eq(analyticsAlerts.status, filters.status));
    }
    if (filters?.severity) {
      conditions.push(eq(analyticsAlerts.severity, filters.severity));
    }
    if (filters?.metricName) {
      conditions.push(eq(analyticsAlerts.metricName, filters.metricName));
    }

    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;

    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(analyticsAlerts)
      .where(and(...conditions));

    const rows = await db
      .select()
      .from(analyticsAlerts)
      .where(and(...conditions))
      .orderBy(desc(analyticsAlerts.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      alerts: rows.map(mapAlert),
      total: totalResult[0]?.count ?? 0,
    };
  },

  async getAlert(
    orgId: string,
    alertId: string,
  ): Promise<AnalyticsAlert | null> {
    const rows = await db
      .select()
      .from(analyticsAlerts)
      .where(
        and(
          eq(analyticsAlerts.id, alertId),
          eq(analyticsAlerts.orgId, orgId),
        ),
      )
      .limit(1);

    const r = rows[0];
    if (!r) return null;
    return mapAlert(r);
  },

  async acknowledgeAlert(
    orgId: string,
    alertId: string,
    acknowledgedBy: string,
  ): Promise<AnalyticsAlert | null> {
    const existing = await this.getAlert(orgId, alertId);
    if (!existing || existing.status !== 'active') return null;

    const rows = await db
      .update(analyticsAlerts)
      .set({
        status: 'acknowledged',
        acknowledgedBy,
        acknowledgedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(analyticsAlerts.id, alertId))
      .returning();

    const r = rows[0];
    if (!r) return null;
    return mapAlert(r);
  },

  async dismissAlert(
    orgId: string,
    alertId: string,
  ): Promise<AnalyticsAlert | null> {
    const existing = await this.getAlert(orgId, alertId);
    if (!existing) return null;

    const rows = await db
      .update(analyticsAlerts)
      .set({
        status: 'dismissed',
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(analyticsAlerts.id, alertId))
      .returning();

    const r = rows[0];
    if (!r) return null;
    return mapAlert(r);
  },

  async createAlert(
    orgId: string,
    data: {
      ruleId?: string;
      ruleName: string;
      metricName: string;
      severity: AlertSeverity;
      actualValue: number;
      threshold: number;
      scopeDimensions?: Record<string, string>;
      message: string;
    },
  ): Promise<AnalyticsAlert> {
    const rows = await db
      .insert(analyticsAlerts)
      .values({
        orgId,
        ruleId: data.ruleId,
        ruleName: data.ruleName,
        metricName: data.metricName,
        severity: data.severity,
        status: 'active',
        actualValue: data.actualValue,
        threshold: data.threshold,
        scopeDimensions: data.scopeDimensions ?? {},
        message: data.message,
      })
      .returning();

    const r = rows[0];
    if (!r) throw new Error('Failed to create alert');
    return mapAlert(r);
  },

  async evaluateRules(
    orgId: string,
  ): Promise<AnalyticsAlert[]> {
    const rules = await db
      .select()
      .from(analyticsAlertRules)
      .where(
        and(
          eq(analyticsAlertRules.orgId, orgId),
          eq(analyticsAlertRules.isActive, true),
        ),
      );

    const alerts: AnalyticsAlert[] = [];

    for (const rule of rules) {
      const cooldownCheck = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(analyticsAlerts)
        .where(
          and(
            eq(analyticsAlerts.orgId, orgId),
            eq(analyticsAlerts.ruleId, rule.id),
            gte(
              analyticsAlerts.createdAt,
              new Date(Date.now() - rule.cooldownMinutes * 60 * 1000),
            ),
          ),
        );

      if ((cooldownCheck[0]?.count ?? 0) > 0) continue;

      const scopeFilters = (rule.scopeDimensions ?? {}) as Record<string, string>;
      const recentSnapshots = await db
        .select({ value: sql<number>`coalesce(sum(${analyticsSnapshots.value}), 0)::int` })
        .from(analyticsSnapshots)
        .where(
          and(
            eq(analyticsSnapshots.orgId, orgId),
            eq(analyticsSnapshots.metricName, rule.metricName),
            gte(
              analyticsSnapshots.periodFrom,
              new Date(Date.now() - 24 * 60 * 60 * 1000),
            ),
            lte(analyticsSnapshots.periodTo, new Date()),
          ),
        )
        .limit(1);

      let metricValue = recentSnapshots[0]?.value ?? 0;

      if (Object.keys(scopeFilters).length > 0) {
        const scopedSnapshots = await db
          .select({ value: sql<number>`coalesce(sum(${analyticsSnapshots.value}), 0)::int` })
          .from(analyticsSnapshots)
          .where(
            and(
              eq(analyticsSnapshots.orgId, orgId),
              eq(analyticsSnapshots.metricName, rule.metricName),
              gte(
                analyticsSnapshots.periodFrom,
                new Date(Date.now() - 24 * 60 * 60 * 1000),
              ),
              lte(analyticsSnapshots.periodTo, new Date()),
              ...Object.entries(scopeFilters).map(
                ([key, value]) =>
                  sql`${analyticsSnapshots.dimensions} ->> ${key} = ${value}`,
              ),
            ),
          )
          .limit(1);

        metricValue = scopedSnapshots[0]?.value ?? metricValue;
      }

      let triggered = false;
      switch (rule.condition) {
        case 'gt':
          triggered = metricValue > rule.threshold;
          break;
        case 'lt':
          triggered = metricValue < rule.threshold;
          break;
        case 'gte':
          triggered = metricValue >= rule.threshold;
          break;
        case 'lte':
          triggered = metricValue <= rule.threshold;
          break;
        case 'eq':
          triggered = metricValue === rule.threshold;
          break;
      }

      if (triggered) {
        const alert = await this.createAlert(orgId, {
          ruleId: rule.id,
          ruleName: rule.ruleName,
          metricName: rule.metricName,
          severity: rule.severity as AlertSeverity,
          actualValue: metricValue,
          threshold: rule.threshold,
          scopeDimensions: (rule.scopeDimensions ?? {}) as Record<string, string>,
          message: `Metric ${rule.metricName} exceeded threshold: ${metricValue} ${rule.condition} ${rule.threshold}`,
        });
        alerts.push(alert);
      }
    }

    return alerts;
  },
};
