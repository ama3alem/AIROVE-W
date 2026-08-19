import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';

export const aiConversationSessions = pgTable('ai_conversation_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  userId: uuid('user_id').notNull(),
  title: varchar('title', { length: 255 }),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('idx_ai_sessions_org').on(t.orgId),
  userIdx: index('idx_ai_sessions_user').on(t.userId),
  statusIdx: index('idx_ai_sessions_status').on(t.status),
}));

export const aiMessages = pgTable('ai_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull(),
  orgId: uuid('org_id').notNull(),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content').notNull(),
  toolCalls: jsonb('tool_calls'),
  evidence: jsonb('evidence'),
  confidence: varchar('confidence', { length: 20 }),
  responseMode: varchar('response_mode', { length: 30 }),
  status: varchar('status', { length: 20 }).notNull().default('DELIVERED'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  sessionIdx: index('idx_ai_messages_session').on(t.sessionId),
  orgIdx: index('idx_ai_messages_org').on(t.orgId),
  createdIdx: index('idx_ai_messages_created').on(t.createdAt),
}));

export const aiToolCalls = pgTable('ai_tool_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull(),
  orgId: uuid('org_id').notNull(),
  toolName: varchar('tool_name', { length: 100 }).notNull(),
  input: jsonb('input').notNull(),
  output: jsonb('output'),
  error: text('error'),
  authorizationResult: varchar('authorization_result', { length: 50 }).notNull(),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  messageIdx: index('idx_ai_tool_calls_message').on(t.messageId),
  orgIdx: index('idx_ai_tool_calls_org').on(t.orgId),
  toolIdx: index('idx_ai_tool_calls_tool').on(t.toolName),
}));

export const aiActionProposals = pgTable('ai_action_proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  creatorId: uuid('creator_id').notNull(),
  sessionId: uuid('session_id'),
  actionType: varchar('action_type', { length: 50 }).notNull(),
  targetType: varchar('target_type', { length: 100 }).notNull(),
  targetId: varchar('target_id', { length: 100 }).notNull(),
  reason: text('reason').notNull(),
  evidence: jsonb('evidence'),
  confidence: varchar('confidence', { length: 20 }),
  risk: varchar('risk', { length: 30 }),
  requiredApproval: varchar('required_approval', { length: 100 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('PENDING_APPROVAL'),
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  executedAt: timestamp('executed_at', { withTimezone: true }),
  executedBy: uuid('executed_by'),
  executionResult: jsonb('execution_result'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('idx_ai_proposals_org').on(t.orgId),
  creatorIdx: index('idx_ai_proposals_creator').on(t.creatorId),
  sessionIdx: index('idx_ai_proposals_session').on(t.sessionId),
  statusIdx: index('idx_ai_proposals_status').on(t.status),
  idempotencyIdx: index('idx_ai_proposals_idempotency').on(t.idempotencyKey),
}));

export const aiActionApprovals = pgTable('ai_action_approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  proposalId: uuid('proposal_id').notNull(),
  orgId: uuid('org_id').notNull(),
  approverId: uuid('approver_id').notNull(),
  decision: varchar('decision', { length: 20 }).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  proposalIdx: index('idx_ai_approvals_proposal').on(t.proposalId),
  orgIdx: index('idx_ai_approvals_org').on(t.orgId),
  approverIdx: index('idx_ai_approvals_approver').on(t.approverId),
}));

export const aiInteractions = pgTable('ai_interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  userId: uuid('user_id').notNull(),
  sessionId: uuid('session_id'),
  interactionType: varchar('interaction_type', { length: 50 }).notNull(),
  details: jsonb('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('idx_ai_interactions_org').on(t.orgId),
  userIdx: index('idx_ai_interactions_user').on(t.userId),
  sessionIdx: index('idx_ai_interactions_session').on(t.sessionId),
  typeIdx: index('idx_ai_interactions_type').on(t.interactionType),
}));
