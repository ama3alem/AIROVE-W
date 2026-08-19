import { pgTable, varchar, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core';

export const serviceIdentities = pgTable('service_identities', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  apiKeyHash: varchar('api_key_hash', { length: 255 }).notNull(),
  permissions: text('permissions'),
  rateLimit: integer('rate_limit').default(1000),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
