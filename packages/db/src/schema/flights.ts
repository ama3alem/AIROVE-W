import { pgTable, varchar, text, timestamp, uuid, integer, date } from 'drizzle-orm/pg-core';

export const flights = pgTable('flights', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  airlineId: uuid('airline_id'),
  flightNumber: varchar('flight_number', { length: 20 }).notNull(),
  departureAirportId: uuid('departure_airport_id'),
  arrivalAirportId: uuid('arrival_airport_id'),
  scheduledDeparture: timestamp('scheduled_departure', { withTimezone: true }),
  scheduledArrival: timestamp('scheduled_arrival', { withTimezone: true }),
  actualDeparture: timestamp('actual_departure', { withTimezone: true }),
  actualArrival: timestamp('actual_arrival', { withTimezone: true }),
  status: varchar('status', { length: 30 }).notNull().default('scheduled'),
  flightDate: date('flight_date'),
  tailNumber: varchar('tail_number', { length: 20 }),
  aircraftType: varchar('aircraft_type', { length: 50 }),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
