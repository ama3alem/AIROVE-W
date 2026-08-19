import { Hono } from 'hono';
import { db, baggageEvents } from '@airove/db';
import { eq, and } from 'drizzle-orm';
import { createBaggageEventSchema, paginationSchema } from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import { baggageEventQueue } from '../workers/baggage-event-worker';
import type { AppEnv } from '../types/env';

export const baggageEventRoutes = new Hono<AppEnv>();

baggageEventRoutes.use('*', rateLimiter({ maxRequests: 200 }));
baggageEventRoutes.use('*', authMiddleware);

baggageEventRoutes.get('/', requirePermission(PERMISSIONS.BAGGAGE_EVENT_READ), async (c) => {
  const authCtx = c.get('auth');
  const { page, pageSize } = paginationSchema.parse(c.req.query());

  const all = await db.query.baggageEvents.findMany({
    where: eq(baggageEvents.orgId, authCtx.orgId),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return c.json({ success: true, data: all });
});

baggageEventRoutes.post('/', requirePermission(PERMISSIONS.BAGGAGE_EVENT_CREATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createBaggageEventSchema.parse(body);

  if (validated.idempotencyKey) {
    const existing = await db.query.baggageEvents.findFirst({
      where: and(
        eq(baggageEvents.orgId, authCtx.orgId),
        eq(baggageEvents.idempotencyKey, validated.idempotencyKey),
      ),
    });

    if (existing) {
      return c.json({ success: true, data: existing });
    }
  }

  const data = {
    orgId: authCtx.orgId,
    baggageId: validated.baggageId,
    flightId: validated.flightId,
    eventType: validated.eventType,
    eventSource: validated.eventSource,
    location: validated.location,
    airportCode: validated.airportCode,
    terminal: validated.terminal,
    handler: validated.handler,
    idempotencyKey: validated.idempotencyKey,
    rawPayload: validated.rawPayload,
    occurredAt: new Date(validated.occurredAt),
    status: 'queued' as const,
  };

  const result = await db.insert(baggageEvents).values(data).returning();
  const event = result[0];

  if (!event) {
    return c.json(
      { success: false, error: { code: 'CREATE_FAILED', message: 'Failed to create event' } },
      500,
    );
  }

  await baggageEventQueue.add(
    'process-event',
    {
      eventId: event.id,
      orgId: authCtx.orgId,
    },
    {
      jobId: validated.idempotencyKey || undefined,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  );

  return c.json({ success: true, data: event }, 201);
});

baggageEventRoutes.get('/:id', requirePermission(PERMISSIONS.BAGGAGE_EVENT_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const event = await db.query.baggageEvents.findFirst({
    where: and(eq(baggageEvents.id, id), eq(baggageEvents.orgId, authCtx.orgId)),
  });

  if (!event) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Event not found' } },
      404,
    );
  }

  return c.json({ success: true, data: event });
});
