import { pgTable, varchar, text, timestamp, uuid, integer, boolean, numeric, index } from 'drizzle-orm/pg-core';
import { cases } from './cases.js';

export const recoveryPlans = pgTable('recovery_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  caseId: uuid('case_id').notNull().references(() => cases.id),
  baggageId: uuid('baggage_id'),
  planNumber: varchar('plan_number', { length: 50 }).notNull(),
  recoveryType: varchar('recovery_type', { length: 30 }).notNull().default('air'),
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  origin: varchar('origin', { length: 10 }).notNull(),
  destination: varchar('destination', { length: 10 }).notNull(),
  currentLocation: varchar('current_location', { length: 10 }),
  slaRemainingMinutes: integer('sla_remaining_minutes'),
  selectedRouteOptionId: uuid('selected_route_option_id'),
  approvalLevel: varchar('approval_level', { length: 30 }),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  riskLevel: varchar('risk_level', { length: 20 }),
  estimatedCost: numeric('estimated_cost', { precision: 12, scale: 2 }),
  actualCost: numeric('actual_cost', { precision: 12, scale: 2 }),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('idx_recovery_plans_org').on(t.orgId),
  caseIdx: index('idx_recovery_plans_case').on(t.caseId),
  statusIdx: index('idx_recovery_plans_status').on(t.status),
  baggageIdx: index('idx_recovery_plans_baggage').on(t.baggageId),
}));

export const recoveryRouteOptions = pgTable('recovery_route_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  recoveryPlanId: uuid('recovery_plan_id').notNull().references(() => recoveryPlans.id),
  optionLabel: varchar('option_label', { length: 10 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('active'),
  totalEtaMinutes: integer('total_eta_minutes'),
  totalDistance: integer('total_distance'),
  segmentCount: integer('segment_count').notNull().default(0),
  riskLevel: varchar('risk_level', { length: 20 }).notNull().default('medium'),
  slaCompliant: boolean('sla_compliant').notNull().default(true),
  slaMarginMinutes: integer('sla_margin_minutes'),
  estimatedCost: numeric('estimated_cost', { precision: 12, scale: 2 }),
  score: numeric('score', { precision: 6, scale: 2 }),
  scoreBreakdown: text('score_breakdown'),
  rejectionReason: text('rejection_reason'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  planIdx: index('idx_route_options_plan').on(t.recoveryPlanId),
  scoreIdx: index('idx_route_options_score').on(t.score),
}));

export const recoveryRouteSegments = pgTable('recovery_route_segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  routeOptionId: uuid('route_option_id').notNull().references(() => recoveryRouteOptions.id),
  segmentOrder: integer('segment_order').notNull(),
  origin: varchar('origin', { length: 10 }).notNull(),
  destination: varchar('destination', { length: 10 }).notNull(),
  mode: varchar('mode', { length: 20 }).notNull(),
  carrier: varchar('carrier', { length: 50 }),
  flightNumber: varchar('flight_number', { length: 50 }),
  flightId: uuid('flight_id'),
  scheduledDeparture: timestamp('scheduled_departure', { withTimezone: true }),
  scheduledArrival: timestamp('scheduled_arrival', { withTimezone: true }),
  estimatedDeparture: timestamp('estimated_departure', { withTimezone: true }),
  estimatedArrival: timestamp('estimated_arrival', { withTimezone: true }),
  durationMinutes: integer('duration_minutes'),
  connectionMinutes: integer('connection_minutes'),
  status: varchar('status', { length: 30 }).notNull().default('planned'),
  providerId: uuid('provider_id'),
  providerServiceId: uuid('provider_service_id'),
  cost: numeric('cost', { precision: 12, scale: 2 }),
  riskLevel: varchar('risk_level', { length: 20 }),
  notes: text('notes'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  optionIdx: index('idx_route_segments_option').on(t.routeOptionId),
  orderIdx: index('idx_route_segments_order').on(t.segmentOrder),
}));

export const recoveryPlanVersions = pgTable('recovery_plan_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  recoveryPlanId: uuid('recovery_plan_id').notNull().references(() => recoveryPlans.id),
  versionNumber: integer('version_number').notNull(),
  routeOptionId: uuid('route_option_id').notNull().references(() => recoveryRouteOptions.id),
  changeReason: text('change_reason').notNull(),
  snapshot: text('snapshot').notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  planIdx: index('idx_plan_versions_plan').on(t.recoveryPlanId),
}));

export const recoveryExecutions = pgTable('recovery_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  recoveryPlanId: uuid('recovery_plan_id').notNull().references(() => recoveryPlans.id),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  externalReference: varchar('external_reference', { length: 255 }),
  providerId: uuid('provider_id'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  failureReason: text('failure_reason'),
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  planIdx: index('idx_executions_plan').on(t.recoveryPlanId),
  statusIdx: index('idx_executions_status').on(t.status),
}));

export const recoveryExecutionSteps = pgTable('recovery_execution_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  executionId: uuid('execution_id').notNull().references(() => recoveryExecutions.id),
  stepOrder: integer('step_order').notNull(),
  stepType: varchar('step_type', { length: 50 }).notNull(),
  description: varchar('description', { length: 500 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  externalReference: varchar('external_reference', { length: 255 }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  failureReason: text('failure_reason'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  executionIdx: index('idx_exec_steps_execution').on(t.executionId),
}));

export const routeConstraints = pgTable('route_constraints', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  recoveryPlanId: uuid('recovery_plan_id'),
  routeOptionId: uuid('route_option_id'),
  constraintType: varchar('constraint_type', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 10 }).notNull(),
  description: varchar('description', { length: 1000 }).notNull(),
  details: text('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  planIdx: index('idx_constraints_plan').on(t.recoveryPlanId),
  optionIdx: index('idx_constraints_option').on(t.routeOptionId),
  severityIdx: index('idx_constraints_severity').on(t.severity),
}));

export const recoveryProviders = pgTable('recovery_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  coverage: text('coverage').notNull().default('[]'),
  status: varchar('status', { length: 30 }).notNull().default('active'),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('idx_providers_org').on(t.orgId),
  statusIdx: index('idx_providers_status').on(t.status),
}));

export const providerServices = pgTable('provider_services', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  providerId: uuid('provider_id').notNull().references(() => recoveryProviders.id),
  serviceName: varchar('service_name', { length: 255 }).notNull(),
  serviceType: varchar('service_type', { length: 100 }).notNull(),
  coverage: text('coverage').notNull().default('[]'),
  estimatedDurationMinutes: integer('estimated_duration_minutes'),
  cost: numeric('cost', { precision: 12, scale: 2 }),
  capacity: integer('capacity'),
  status: varchar('status', { length: 30 }).notNull().default('active'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  providerIdx: index('idx_provider_services_provider').on(t.providerId),
}));

export const recoveryProviderAssignments = pgTable('recovery_provider_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  recoveryPlanId: uuid('recovery_plan_id').notNull().references(() => recoveryPlans.id),
  providerId: uuid('provider_id').notNull().references(() => recoveryProviders.id),
  providerServiceId: uuid('provider_service_id'),
  assignedBy: uuid('assigned_by'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  status: varchar('status', { length: 30 }).notNull().default('assigned'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  planIdx: index('idx_provider_assignments_plan').on(t.recoveryPlanId),
  providerIdx: index('idx_provider_assignments_provider').on(t.providerId),
}));
