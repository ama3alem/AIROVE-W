import { db, expectedEvents, flights, journeys, baggage } from '@airove/db';
import { eq, and, asc, desc, lt } from 'drizzle-orm';
import { logger } from './logger';
import type { OperationalEventType, ExpectedEventStatus } from '@airove/shared';

export interface GenerateExpectedEventsInput {
  orgId: string;
  baggageId: string;
  flightId?: string;
  journeyId?: string;
}

export class ExpectedEventsEngine {
  async generateFromFlightContext(input: GenerateExpectedEventsInput) {
    if (!input.flightId) return [];

    const flight = await db.query.flights.findFirst({
      where: eq(flights.id, input.flightId),
    });

    if (!flight) return [];

    const events: Array<{
      expectedType: OperationalEventType;
      expectedAt: Date;
      expectedLocation: string | null;
      expectedAirportCode: string | null;
    }> = [];

    if (flight.scheduledDeparture) {
      events.push({
        expectedType: 'baggage_loaded',
        expectedAt: new Date(new Date(flight.scheduledDeparture).getTime() - 30 * 60 * 1000),
        expectedLocation: null,
        expectedAirportCode: null,
      });
    }

    if (flight.scheduledArrival) {
      events.push({
        expectedType: 'baggage_arrived',
        expectedAt: flight.scheduledArrival,
        expectedLocation: null,
        expectedAirportCode: null,
      });

      events.push({
        expectedType: 'baggage_unloaded',
        expectedAt: new Date(new Date(flight.scheduledArrival).getTime() + 20 * 60 * 1000),
        expectedLocation: null,
        expectedAirportCode: null,
      });
    }

    const created = [];
    for (const evt of events) {
      const result = await db.insert(expectedEvents).values({
        orgId: input.orgId,
        baggageId: input.baggageId,
        flightId: input.flightId,
        journeyId: input.journeyId ?? null,
        expectedType: evt.expectedType,
        expectedAt: evt.expectedAt,
        expectedLocation: evt.expectedLocation,
        expectedAirportCode: evt.expectedAirportCode,
        status: 'expected',
      }).returning();

      if (result[0]) created.push(result[0]);
    }

    return created;
  }

  async fulfillExpectedEvent(params: {
    expectedEventId: string;
    actualEventId: string;
  }) {
    const expected = await db.query.expectedEvents.findFirst({
      where: eq(expectedEvents.id, params.expectedEventId),
    });

    if (!expected || expected.status !== 'expected') {
      return null;
    }

    const [updated] = await db
      .update(expectedEvents)
      .set({
        status: 'fulfilled',
        fulfilledByEventId: params.actualEventId,
        fulfilledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(expectedEvents.id, params.expectedEventId))
      .returning();

    return updated ?? null;
  }

  async findMatchingExpectedEvent(params: {
    baggageId: string;
    eventType: string;
    orgId: string;
  }) {
    return db.query.expectedEvents.findFirst({
      where: and(
        eq(expectedEvents.baggageId, params.baggageId),
        eq(expectedEvents.expectedType, params.eventType),
        eq(expectedEvents.status, 'expected'),
        eq(expectedEvents.orgId, params.orgId),
      ),
      orderBy: [asc(expectedEvents.expectedAt)],
    });
  }

  async checkExpiredExpectations(orgId: string) {
    const now = new Date();
    const expiredThreshold = new Date(now.getTime() - 60 * 60 * 1000);

    const expired = await db.query.expectedEvents.findMany({
      where: and(
        eq(expectedEvents.orgId, orgId),
        eq(expectedEvents.status, 'expected'),
        lt(expectedEvents.expectedAt, expiredThreshold),
      ),
    });

    for (const exp of expired) {
      await db
        .update(expectedEvents)
        .set({
          status: 'expired',
          expiredAt: now,
          updatedAt: now,
        })
        .where(eq(expectedEvents.id, exp.id));
    }

    return expired;
  }

  async listByBaggage(baggageId: string, orgId: string) {
    return db.query.expectedEvents.findMany({
      where: and(
        eq(expectedEvents.baggageId, baggageId),
        eq(expectedEvents.orgId, orgId),
      ),
      orderBy: [asc(expectedEvents.expectedAt)],
    });
  }

  async listByStatus(orgId: string, status: ExpectedEventStatus) {
    return db.query.expectedEvents.findMany({
      where: and(
        eq(expectedEvents.orgId, orgId),
        eq(expectedEvents.status, status),
      ),
      orderBy: [asc(expectedEvents.expectedAt)],
    });
  }

  async createManualExpectedEvent(params: {
    orgId: string;
    baggageId: string;
    flightId?: string;
    journeyId?: string;
    expectedType: OperationalEventType;
    expectedAt: Date;
    expectedLocation?: string;
    expectedAirportCode?: string;
    notes?: string;
  }) {
    const result = await db.insert(expectedEvents).values({
      orgId: params.orgId,
      baggageId: params.baggageId,
      flightId: params.flightId ?? null,
      journeyId: params.journeyId ?? null,
      expectedType: params.expectedType,
      expectedAt: params.expectedAt,
      expectedLocation: params.expectedLocation ?? null,
      expectedAirportCode: params.expectedAirportCode ?? null,
      status: 'expected',
      notes: params.notes ?? null,
    }).returning();

    return result[0] ?? null;
  }
}

export const expectedEventsEngine = new ExpectedEventsEngine();
