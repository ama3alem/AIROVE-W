import { Hono } from 'hono';
import { db, baggage } from '@airove/db';
import { eq, and } from 'drizzle-orm';
import { createExpectedEventSchema, paginationSchema } from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { expectedEventsEngine } from '../lib/expected-events.js';
import { exceptionService } from '../lib/exception-service.js';
import type { OperationalEventType } from '@airove/shared';
import type { AppEnv } from '../types/env.js';

export const expectedEventRoutes = new Hono<AppEnv>();

expectedEventRoutes.use('*', rateLimiter({ maxRequests: 60 }));
expectedEventRoutes.use('*', authMiddleware);

expectedEventRoutes.get('/', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const status = c.req.query('status') as 'expected' | 'fulfilled' | 'missed' | 'expired' | 'cancelled' | null;

  if (status) {
    const events = await expectedEventsEngine.listByStatus(authCtx.orgId, status);
    return c.json({ success: true, data: events });
  }

  const { page, pageSize } = paginationSchema.parse(c.req.query());
  const events = await expectedEventsEngine.listByStatus(authCtx.orgId, 'expected');
  return c.json({ success: true, data: events });
});

expectedEventRoutes.post('/', requirePermission(PERMISSIONS.BAGGAGE_EVENT_CREATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createExpectedEventSchema.parse(body);

  const bag = await db.query.baggage.findFirst({
    where: and(eq(baggage.id, validated.baggageId), eq(baggage.orgId, authCtx.orgId)),
  });

  if (!bag) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Baggage not found' } },
      404,
    );
  }

  const expectedEvent = await expectedEventsEngine.createManualExpectedEvent({
    orgId: authCtx.orgId,
    baggageId: validated.baggageId,
    flightId: validated.flightId,
    journeyId: validated.journeyId,
    expectedType: validated.expectedType as OperationalEventType,
    expectedAt: new Date(validated.expectedAt),
    expectedLocation: validated.expectedLocation,
    expectedAirportCode: validated.expectedAirportCode,
    notes: validated.notes,
  });

  if (!expectedEvent) {
    return c.json(
      { success: false, error: { code: 'CREATE_FAILED', message: 'Failed to create expected event' } },
      500,
    );
  }

  return c.json({ success: true, data: expectedEvent }, 201);
});

expectedEventRoutes.get('/check-expired', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');

  const expired = await expectedEventsEngine.checkExpiredExpectations(authCtx.orgId);

  const exceptions = [];
  for (const exp of expired) {
    const exc = await exceptionService.generateTransferMissingException({
      orgId: authCtx.orgId,
      baggageId: exp.baggageId,
      expectedEventId: exp.id,
      location: exp.expectedLocation ?? undefined,
      airportCode: exp.expectedAirportCode ?? undefined,
    });
    exceptions.push(exc);
  }

  return c.json({
    success: true,
    data: {
      expiredCount: expired.length,
      exceptionsCreated: exceptions.length,
    },
  });
});

expectedEventRoutes.get('/baggage/:baggageId', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { baggageId } = c.req.param();

  const events = await expectedEventsEngine.listByBaggage(baggageId, authCtx.orgId);
  return c.json({ success: true, data: events });
});
