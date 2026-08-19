import { pgTable, varchar, text, timestamp, uuid, integer, jsonb, index } from 'drizzle-orm/pg-core';

export const integrations = pgTable('integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  provider: varchar('provider', { length: 100 }),
  status: varchar('status', { length: 30 }).notNull().default('configuring'),
  config: text('config'),
  mappingConfig: jsonb('mapping_config'),
  webhookSecret: varchar('webhook_secret', { length: 500 }),
  credentialRef: varchar('credential_ref', { length: 500 }),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
  lastError: text('last_error'),
  consecutiveFailures: integer('consecutive_failures').default(0),
  totalEventsReceived: integer('total_events_received').default(0),
  totalEventsFailed: integer('total_events_failed').default(0),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const integrationEvents = pgTable('integration_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationId: uuid('integration_id').notNull(),
  orgId: uuid('org_id').notNull(),
  externalEventId: varchar('external_event_id', { length: 255 }).notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('received'),
  rawPayload: text('raw_payload'),
  normalizedPayload: text('normalized_payload'),
  mappingVersion: varchar('mapping_version', { length: 20 }),
  failureReason: text('failure_reason'),
  retryCount: integer('retry_count').default(0),
  maxRetries: integer('max_retries').default(3),
  correlationId: varchar('correlation_id', { length: 100 }),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  integrationIdx: index('idx_integration_events_integration').on(t.integrationId),
  externalIdIdx: index('idx_integration_events_external_id').on(t.externalEventId),
  statusIdx: index('idx_integration_events_status').on(t.status),
}));

export const entityMappings = pgTable('entity_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  integrationId: uuid('integration_id').notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  externalId: varchar('external_id', { length: 255 }).notNull(),
  internalId: uuid('internal_id').notNull(),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  lookupIdx: index('idx_entity_mappings_lookup').on(t.integrationId, t.entityType, t.externalId),
}));

export const outboundDeliveries = pgTable('outbound_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationId: uuid('integration_id').notNull(),
  orgId: uuid('org_id').notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  payload: text('payload'),
  response: text('response'),
  statusCode: integer('status_code'),
  attemptCount: integer('attempt_count').default(0),
  maxAttempts: integer('max_attempts').default(3),
  lastError: text('last_error'),
  correlationId: varchar('correlation_id', { length: 100 }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index('idx_outbound_deliveries_status').on(t.status),
}));
