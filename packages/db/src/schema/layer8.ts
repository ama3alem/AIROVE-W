import { pgTable, uuid, varchar, integer, boolean, jsonb, text, timestamp } from 'drizzle-orm/pg-core';

export const intelligenceResults = pgTable('intelligence_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('org_id').notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),
  confidence: varchar('confidence', { length: 20 }).notNull(),
  severity: varchar('severity', { length: 20 }),
  summary: text('summary').notNull(),
  explanation: text('explanation').notNull(),
  evidence: jsonb('evidence').notNull().default([]),
  model: varchar('model', { length: 100 }).notNull(),
  version: varchar('version', { length: 50 }).notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export const predictions = pgTable('predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('org_id').notNull(),
  predictionType: varchar('prediction_type', { length: 50 }).notNull(),
  subjectType: varchar('subject_type', { length: 50 }).notNull(),
  subjectId: varchar('subject_id', { length: 100 }).notNull(),
  probability: integer('probability').notNull(),
  confidence: varchar('confidence', { length: 20 }).notNull(),
  horizon: integer('horizon').notNull(),
  explanation: text('explanation').notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  version: varchar('version', { length: 50 }).notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export const riskAssessments = pgTable('risk_assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('org_id').notNull(),
  subjectType: varchar('subject_type', { length: 50 }).notNull(),
  subjectId: varchar('subject_id', { length: 100 }).notNull(),
  riskLevel: varchar('risk_level', { length: 20 }).notNull(),
  factors: jsonb('factors').notNull().default([]),
  explanation: text('explanation').notNull(),
  confidence: varchar('confidence', { length: 20 }).notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const anomalies = pgTable('anomalies', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('org_id').notNull(),
  anomalyType: varchar('anomaly_type', { length: 50 }).notNull(),
  subjectType: varchar('subject_type', { length: 50 }).notNull(),
  subjectId: varchar('subject_id', { length: 100 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  score: integer('score').notNull(),
  explanation: text('explanation').notNull(),
  confidence: varchar('confidence', { length: 20 }).notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rootCauseAnalyses = pgTable('root_cause_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('org_id').notNull(),
  subjectType: varchar('subject_type', { length: 50 }).notNull(),
  subjectId: varchar('subject_id', { length: 100 }).notNull(),
  explanation: text('explanation').notNull(),
  confidence: varchar('confidence', { length: 20 }).notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const recommendations = pgTable('recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('org_id').notNull(),
  priority: varchar('priority', { length: 20 }).notNull(),
  recommendation: text('recommendation').notNull(),
  confidence: varchar('confidence', { length: 20 }).notNull(),
  impact: text('impact').notNull(),
  requiredApproval: varchar('required_approval', { length: 100 }),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
});