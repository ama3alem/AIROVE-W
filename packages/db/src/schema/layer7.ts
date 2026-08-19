import { pgTable, varchar, text, timestamp, uuid, boolean, integer, jsonb, index } from 'drizzle-orm/pg-core';

export const analyticsDefinitions = pgTable('analytics_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  metricName: varchar('metric_name', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 200 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }).notNull(),
  aggregationType: varchar('aggregation_type', { length: 30 }).notNull(),
  supportedDimensions: jsonb('supported_dimensions').notNull().default([]),
  unit: varchar('unit', { length: 30 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('idx_analytics_defs_org').on(t.orgId),
  metricNameIdx: index('idx_analytics_defs_metric_name').on(t.metricName),
  categoryIdx: index('idx_analytics_defs_category').on(t.category),
}));

export const analyticsSnapshots = pgTable('analytics_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  metricName: varchar('metric_name', { length: 100 }).notNull(),
  dimensions: jsonb('dimensions').notNull().default({}),
  value: integer('value').notNull(),
  previousValue: integer('previous_value'),
  absoluteChange: integer('absolute_change'),
  percentageChange: integer('percentage_change'),
  periodFrom: timestamp('period_from', { withTimezone: true }).notNull(),
  periodTo: timestamp('period_to', { withTimezone: true }).notNull(),
  granularity: varchar('granularity', { length: 20 }).notNull().default('day'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('idx_analytics_snapshots_org').on(t.orgId),
  metricIdx: index('idx_analytics_snapshots_metric').on(t.metricName),
  periodIdx: index('idx_analytics_snapshots_period').on(t.periodFrom, t.periodTo),
  granularityIdx: index('idx_analytics_snapshots_granularity').on(t.granularity),
}));

export const analyticsAlertRules = pgTable('analytics_alert_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  ruleName: varchar('rule_name', { length: 255 }).notNull(),
  metricName: varchar('metric_name', { length: 100 }).notNull(),
  condition: varchar('condition', { length: 10 }).notNull(),
  threshold: integer('threshold').notNull(),
  severity: varchar('severity', { length: 20 }).notNull().default('warning'),
  scopeDimensions: jsonb('scope_dimensions').notNull().default({}),
  cooldownMinutes: integer('cooldown_minutes').notNull().default(30),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('idx_alert_rules_org').on(t.orgId),
  metricIdx: index('idx_alert_rules_metric').on(t.metricName),
  severityIdx: index('idx_alert_rules_severity').on(t.severity),
}));

export const analyticsAlerts = pgTable('analytics_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  ruleId: uuid('rule_id'),
  ruleName: varchar('rule_name', { length: 255 }).notNull(),
  metricName: varchar('metric_name', { length: 100 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  actualValue: integer('actual_value').notNull(),
  threshold: integer('threshold').notNull(),
  scopeDimensions: jsonb('scope_dimensions').notNull().default({}),
  message: text('message'),
  acknowledgedBy: uuid('acknowledged_by'),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('idx_analytics_alerts_org').on(t.orgId),
  statusIdx: index('idx_analytics_alerts_status').on(t.status),
  severityIdx: index('idx_analytics_alerts_severity').on(t.severity),
  metricIdx: index('idx_analytics_alerts_metric').on(t.metricName),
}));

export const analyticsSavedViews = pgTable('analytics_saved_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  userId: uuid('user_id').notNull(),
  viewName: varchar('view_name', { length: 255 }).notNull(),
  description: text('description'),
  filters: jsonb('filters').notNull().default({}),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('idx_saved_views_org').on(t.orgId),
  userIdx: index('idx_saved_views_user').on(t.userId),
}));

export const analyticsExports = pgTable('analytics_exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  userId: uuid('user_id').notNull(),
  exportType: varchar('export_type', { length: 50 }).notNull(),
  format: varchar('format', { length: 10 }).notNull(),
  filters: jsonb('filters').notNull().default({}),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  fileUrl: text('file_url'),
  rowCount: integer('row_count'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (t) => ({
  orgIdx: index('idx_analytics_exports_org').on(t.orgId),
  statusIdx: index('idx_analytics_exports_status').on(t.status),
}));
