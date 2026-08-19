import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';

export function baseColumns(orgScoped = true) {
  const columns = {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  };

  if (orgScoped) {
    return {
      ...columns,
      orgId: uuid('org_id').notNull(),
    };
  }

  return columns;
}
