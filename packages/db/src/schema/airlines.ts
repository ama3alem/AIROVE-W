import { pgTable, varchar, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const airlines = pgTable('airlines', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  iataCode: varchar('iata_code', { length: 3 }).notNull().unique(),
  icaoCode: varchar('icao_code', { length: 4 }),
  name: varchar('name', { length: 255 }).notNull(),
  country: varchar('country', { length: 100 }),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
