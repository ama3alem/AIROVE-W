import { pgTable, varchar, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const handovers = pgTable('handovers', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  baggageId: uuid('baggage_id').notNull(),
  flightId: uuid('flight_id'),
  fromParty: varchar('from_party', { length: 100 }).notNull(),
  fromPartyType: varchar('from_party_type', { length: 50 }),
  toParty: varchar('to_party', { length: 100 }).notNull(),
  toPartyType: varchar('to_party_type', { length: 50 }),
  handoverType: varchar('handover_type', { length: 50 }).notNull(),
  location: varchar('location', { length: 100 }),
  airportCode: varchar('airport_code', { length: 3 }),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  notes: text('notes'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
