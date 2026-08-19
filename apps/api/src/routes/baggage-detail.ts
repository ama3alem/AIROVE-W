import { Hono } from 'hono';
import { db, baggage, journeys, journeySegments, flights, baggageStateProjections } from '@airove/db';
import { eq, and, desc } from 'drizzle-orm';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import { eventService } from '../lib/event-service';
import { custodyService } from '../lib/custody-service';
import { exceptionService } from '../lib/exception-service';
import type { AppEnv } from '../types/env';

export const baggageDetailRoutes = new Hono<AppEnv>();

baggageDetailRoutes.use('*', rateLimiter({ maxRequests: 100 }));
baggageDetailRoutes.use('*', authMiddleware);

baggageDetailRoutes.get('/:id/timeline', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const bag = await db.query.baggage.findFirst({
    where: and(eq(baggage.id, id), eq(baggage.orgId, authCtx.orgId)),
  });

  if (!bag) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Baggage not found' } },
      404,
    );
  }

  const timeline = await eventService.getTimeline(id, authCtx.orgId);

  return c.json({ success: true, data: { baggageId: id, timeline } });
});

baggageDetailRoutes.get('/:id/state', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const bag = await db.query.baggage.findFirst({
    where: and(eq(baggage.id, id), eq(baggage.orgId, authCtx.orgId)),
  });

  if (!bag) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Baggage not found' } },
      404,
    );
  }

  const projection = await eventService.getStateProjection(id, authCtx.orgId);

  return c.json({
    success: true,
    data: {
      baggageId: id,
      currentState: projection?.currentState ?? bag.currentState,
      location: projection?.currentLocation ?? bag.currentLocation,
      airportCode: projection?.currentAirportCode,
      custodian: projection?.currentCustodian ?? bag.currentCustodian,
      custodianType: projection?.currentCustodianType ?? bag.currentCustodianType,
      lastEvent: projection?.lastEventType,
      lastEventAt: projection?.lastEventAt,
      expectedNextEvent: projection?.expectedNextEvent,
      sequenceNumber: projection?.sequenceNumber ?? 0,
      eventCount: projection?.eventCount ?? 0,
    },
  });
});

baggageDetailRoutes.get('/:id/custody', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const bag = await db.query.baggage.findFirst({
    where: and(eq(baggage.id, id), eq(baggage.orgId, authCtx.orgId)),
  });

  if (!bag) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Baggage not found' } },
      404,
    );
  }

  const current = await custodyService.getCurrentCustody(id, authCtx.orgId);
  const history = await custodyService.getCustodyHistory(id, authCtx.orgId);

  return c.json({
    success: true,
    data: {
      baggageId: id,
      currentCustody: current,
      custodyHistory: history,
    },
  });
});

baggageDetailRoutes.get('/:id/journey', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const bag = await db.query.baggage.findFirst({
    where: and(eq(baggage.id, id), eq(baggage.orgId, authCtx.orgId)),
  });

  if (!bag) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Baggage not found' } },
      404,
    );
  }

  if (!bag.journeyId) {
    return c.json({
      success: true,
      data: { baggageId: id, journey: null },
    });
  }

  const journey = await db.query.journeys.findFirst({
    where: eq(journeys.id, bag.journeyId),
  });

  let segments: Array<{ flightId: string; flightNumber: string; status: string; segmentOrder: number }> = [];

  if (journey) {
    const rawSegments = await db.query.journeySegments.findMany({
      where: eq(journeySegments.journeyId, journey.id),
    });

    for (const seg of rawSegments) {
      const flight = await db.query.flights.findFirst({
        where: eq(flights.id, seg.flightId),
      });

      segments.push({
        flightId: seg.flightId,
        flightNumber: flight?.flightNumber ?? 'UNKNOWN',
        status: flight?.status ?? 'unknown',
        segmentOrder: seg.segmentOrder,
      });
    }
  }

  return c.json({
    success: true,
    data: {
      baggageId: id,
      journey: journey
        ? {
            ...journey,
            flightSegments: segments,
          }
        : null,
    },
  });
});

baggageDetailRoutes.get('/:id/detail', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const bag = await db.query.baggage.findFirst({
    where: and(eq(baggage.id, id), eq(baggage.orgId, authCtx.orgId)),
  });

  if (!bag) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Baggage not found' } },
      404,
    );
  }

  const projection = await eventService.getStateProjection(id, authCtx.orgId);
  const custody = await custodyService.getCurrentCustody(id, authCtx.orgId);
  const exceptions = await exceptionService.listByBaggage(id, authCtx.orgId);

  const events = await eventService.listEvents(id, authCtx.orgId, 1, 1);
  const lastEvent = events[0] ?? null;

  let journey = null;
  if (bag.journeyId) {
    const j = await db.query.journeys.findFirst({
      where: eq(journeys.id, bag.journeyId),
    });
    if (j) {
      const rawSegs = await db.query.journeySegments.findMany({
        where: eq(journeySegments.journeyId, j.id),
      });
      const segs = [];
      for (const seg of rawSegs) {
        const f = await db.query.flights.findFirst({ where: eq(flights.id, seg.flightId) });
        segs.push({
          flightId: seg.flightId,
          flightNumber: f?.flightNumber ?? 'UNKNOWN',
          departureAirportId: f?.departureAirportId,
          arrivalAirportId: f?.arrivalAirportId,
          scheduledDeparture: f?.scheduledDeparture,
          scheduledArrival: f?.scheduledArrival,
          status: f?.status ?? 'unknown',
        });
      }
      journey = { ...j, flightSegments: segs };
    }
  }

  return c.json({
    success: true,
    data: {
      baggage: {
        id: bag.id,
        tagNumber: bag.tagNumber,
        passengerName: bag.passengerName,
        passengerReference: bag.passengerReference,
        originAirportId: bag.originAirportId,
        destinationAirportId: bag.destinationAirportId,
        weight: bag.weight,
        dimensions: bag.dimensions,
        bagType: bag.bagType,
        priority: bag.priority,
        status: bag.status,
      },
      journey,
      state: {
        currentState: projection?.currentState ?? bag.currentState,
        currentLocation: projection?.currentLocation ?? bag.currentLocation,
        currentAirportCode: projection?.currentAirportCode,
        currentCustodian: projection?.currentCustodian ?? bag.currentCustodian,
        currentCustodianType: projection?.currentCustodianType ?? bag.currentCustodianType,
        lastEventId: projection?.lastEventId,
        lastEventType: projection?.lastEventType,
        lastEventAt: projection?.lastEventAt,
        expectedNextEvent: projection?.expectedNextEvent,
        sequenceNumber: projection?.sequenceNumber ?? 0,
        eventCount: projection?.eventCount ?? 0,
      },
      custody,
      lastEvent: lastEvent ?? null,
      expectedNextEvent: null,
      recentExceptions: exceptions.slice(0, 10),
      eventCount: projection?.eventCount ?? 0,
    },
  });
});

baggageDetailRoutes.get('/:id/integrity', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const bag = await db.query.baggage.findFirst({
    where: and(eq(baggage.id, id), eq(baggage.orgId, authCtx.orgId)),
  });

  if (!bag) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Baggage not found' } },
      404,
    );
  }

  const events = await eventService.listEvents(id, authCtx.orgId, 1, 1000);

  let valid = true;
  let brokenAt: string | null = null;

  for (let i = 1; i < events.length; i++) {
    const current = events[i];
    const previous = events[i - 1];
    if (current && previous && current.previousEventHash !== previous.eventHash) {
      valid = false;
      brokenAt = current.id;
      break;
    }
  }

  return c.json({
    success: true,
    data: {
      baggageId: id,
      chainValid: valid,
      eventsChecked: events.length,
      brokenAt,
    },
  });
});
