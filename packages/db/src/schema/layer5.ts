import { pgTable, varchar, text, timestamp, uuid, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { cases } from './cases';

export const caseActivities = pgTable('case_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id').notNull().references(() => cases.id),
  orgId: uuid('org_id').notNull(),
  activityType: varchar('activity_type', { length: 50 }).notNull(),
  actorId: uuid('actor_id'),
  actorOrganizationId: uuid('actor_organization_id'),
  description: text('description'),
  previousValue: text('previous_value'),
  newValue: text('new_value'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const caseComments = pgTable('case_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id').notNull().references(() => cases.id),
  orgId: uuid('org_id').notNull(),
  authorId: uuid('author_id').notNull(),
  authorOrganizationId: uuid('author_organization_id'),
  content: text('content').notNull(),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const slaPolicies = pgTable('sla_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  caseType: varchar('case_type', { length: 50 }).notNull(),
  priority: varchar('priority', { length: 20 }).notNull(),
  responseMinutes: integer('response_minutes').notNull(),
  resolutionMinutes: integer('resolution_minutes').notNull(),
  warningThresholdPercent: integer('warning_threshold_percent').notNull().default(75),
  escalationThresholdPercent: integer('escalation_threshold_percent').notNull().default(100),
  pauseOnPendingExternal: boolean('pause_on_pending_external').notNull().default(true),
  enabled: boolean('enabled').notNull().default(true),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const caseSla = pgTable('case_sla', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id').notNull().references(() => cases.id),
  orgId: uuid('org_id').notNull(),
  slaPolicyId: uuid('sla_policy_id').notNull().references(() => slaPolicies.id),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  responseDueAt: timestamp('response_due_at', { withTimezone: true }).notNull(),
  resolutionDueAt: timestamp('resolution_due_at', { withTimezone: true }).notNull(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  pausedAt: timestamp('paused_at', { withTimezone: true }),
  resumedAt: timestamp('resumed_at', { withTimezone: true }),
  totalPausedMs: integer('total_paused_ms').notNull().default(0),
  warningTriggeredAt: timestamp('warning_triggered_at', { withTimezone: true }),
  breachTriggeredAt: timestamp('breach_triggered_at', { withTimezone: true }),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const caseEscalations = pgTable('case_escalations', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id').notNull().references(() => cases.id),
  orgId: uuid('org_id').notNull(),
  escalationLevel: varchar('escalation_level', { length: 30 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  slaCaseId: uuid('sla_case_id'),
  triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  acknowledgedBy: uuid('acknowledged_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by'),
  reason: text('reason'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workflowDefinitions = pgTable('workflow_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  version: integer('version').notNull().default(1),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  triggerType: varchar('trigger_type', { length: 50 }).notNull(),
  triggerConfig: text('trigger_config'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workflowRules = pgTable('workflow_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id').notNull().references(() => workflowDefinitions.id),
  orgId: uuid('org_id').notNull(),
  ruleOrder: integer('rule_order').notNull().default(0),
  conditionType: varchar('condition_type', { length: 50 }).notNull(),
  conditionConfig: text('condition_config').notNull(),
  actionType: varchar('action_type', { length: 50 }).notNull(),
  actionConfig: text('action_config').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
