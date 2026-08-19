import { pgTable, varchar, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const airports = pgTable('airports', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  iataCode: varchar('iata_code', { length: 3 }).notNull().unique(),
  icaoCode: varchar('icao_code', { length: 4 }),
  name: varchar('name', { length: 255 }).notNull(),
  city: varchar('city', { length: 255 }),
  country: varchar('country', { length: 100 }),
  timezone: varchar('timezone', { length: 50 }),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
