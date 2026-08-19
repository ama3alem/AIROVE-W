import { Hono } from 'hono';
import { db, baggage } from '@airove/db';
import { eq, and } from 'drizzle-orm';
import { createOperationalEventSchema, correctEventSchema, paginationSchema } from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import { eventService } from '../lib/event-service';
import { custodyService } from '../lib/custody-service';
import { expectedEventsEngine } from '../lib/expected-events';
import type { OperationalEventType } from '@airove/shared';
import type { AppEnv } from '../types/env';

export const operationalEventRoutes = new Hono<AppEnv>();

operationalEventRoutes.use('*', rateLimiter({ maxRequests: 200 }));
operationalEventRoutes.use('*', authMiddleware);

operationalEventRoutes.post('/', requirePermission(PERMISSIONS.BAGGAGE_EVENT_CREATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createOperationalEventSchema.parse(body);

  const bag = await db.query.baggage.findFirst({
    where: and(eq(baggage.id, validated.baggageId), eq(baggage.orgId, authCtx.orgId)),
  });

  if (!bag) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Baggage not found' } },
      404,
    );
  }

  const result = await eventService.createEvent({
    orgId: authCtx.orgId,
    baggageId: validated.baggageId,
    flightId: validated.flightId,
    eventType: validated.eventType as OperationalEventType,
    eventSource: validated.eventSource as 'external_integration' | 'scanner' | 'manual_operator' | 'system' | 'recovery',
    actorType: validated.actorType as 'user' | 'scanner' | 'system' | 'integration' | 'service',
    actorId: validated.actorId,
    location: validated.location,
    airportCode: validated.airportCode,
    terminal: validated.terminal,
    handler: validated.handler,
    idempotencyKey: validated.idempotencyKey,
    rawPayload: validated.rawPayload,
    metadata: validated.metadata as Record<string, string> | undefined,
    occurredAt: new Date(validated.occurredAt),
  });

  if (result.stateTransition && !result.stateTransition.allowed) {
    return c.json({
      success: true,
      data: {
        event: result.event,
        stateTransition: result.stateTransition,
        warning: result.stateTransition.reason,
      },
    }, 201);
  }

  const matchingExpected = await expectedEventsEngine.findMatchingExpectedEvent({
    baggageId: validated.baggageId,
    eventType: validated.eventType,
    orgId: authCtx.orgId,
  });

  if (matchingExpected) {
    await expectedEventsEngine.fulfillExpectedEvent({
      expectedEventId: matchingExpected.id,
      actualEventId: result.event.id,
    });
  }

  return c.json({ success: true, data: { event: result.event, stateTransition: result.stateTransition } }, 201);
});

operationalEventRoutes.get('/:id', requirePermission(PERMISSIONS.BAGGAGE_EVENT_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const event = await eventService.getEventById(id, authCtx.orgId);
  if (!event) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } },
      404,
    );
  }

  return c.json({ success: true, data: event });
});

operationalEventRoutes.get('/:id/integrity', requirePermission(PERMISSIONS.BAGGAGE_EVENT_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const integrity = await eventService.getEventIntegrity(id);
  if (!integrity) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } },
      404,
    );
  }

  return c.json({ success: true, data: integrity });
});

operationalEventRoutes.post('/:id/correct', requirePermission(PERMISSIONS.BAGGAGE_EVENT_CORRECT), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = correctEventSchema.parse(body);

  const correction = await eventService.correctEvent({
    eventId: id,
    orgId: authCtx.orgId,
    correctedEventType: validated.correctedEventType as OperationalEventType,
    reason: validated.reason,
    correctedBy: authCtx.userId,
    metadata: validated.metadata as Record<string, string> | undefined,
  });

  return c.json({ success: true, data: correction }, 201);
});
