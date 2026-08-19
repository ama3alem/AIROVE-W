import { pgTable, varchar, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core';

export const journeys = pgTable('journeys', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  passengerName: varchar('passenger_name', { length: 255 }),
  passengerReference: varchar('passenger_reference', { length: 100 }),
  pnr: varchar('pnr', { length: 10 }),
  originAirportId: uuid('origin_airport_id'),
  destinationAirportId: uuid('destination_airport_id'),
  status: varchar('status', { length: 30 }).notNull().default('active'),
  totalBags: integer('total_bags').default(0),
  connectingFlights: text('connecting_flights'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
