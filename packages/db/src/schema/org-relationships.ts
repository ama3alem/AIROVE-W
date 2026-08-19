import { pgTable, varchar, text, timestamp, uuid, boolean, integer } from 'drizzle-orm/pg-core';

export const orgRelationships = pgTable('org_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentOrgId: uuid('parent_org_id').notNull(),
  childOrgId: uuid('child_org_id').notNull(),
  relationshipType: varchar('relationship_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accessPolicies = pgTable('access_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  policyType: varchar('policy_type', { length: 50 }).notNull(),
  rules: text('rules').notNull(),
  priority: integer('priority').default(0),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
