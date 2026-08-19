import { Hono } from 'hono';
import { db, journeys, journeySegments, flights, baggage } from '@airove/db';
import { eq, and, asc } from 'drizzle-orm';
import { createJourneySchema, paginationSchema } from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import { auditLog } from '../lib/audit-logger';
import type { AppEnv } from '../types/env';

export const journeyRoutes = new Hono<AppEnv>();

journeyRoutes.use('*', rateLimiter({ maxRequests: 60 }));
journeyRoutes.use('*', authMiddleware);

journeyRoutes.get('/', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { page, pageSize } = paginationSchema.parse(c.req.query());

  const all = await db.query.journeys.findMany({
    where: eq(journeys.orgId, authCtx.orgId),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return c.json({ success: true, data: all });
});

journeyRoutes.post('/', requirePermission(PERMISSIONS.BAGGAGE_CREATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createJourneySchema.parse(body);

  const [journey] = await db.insert(journeys).values({
    orgId: authCtx.orgId,
    passengerName: validated.passengerName,
    passengerReference: validated.passengerReference,
    pnr: validated.pnr,
    originAirportId: validated.originAirportId,
    destinationAirportId: validated.destinationAirportId,
    connectingFlights: validated.connectingFlights,
  }).returning();

  if (!journey) {
    return c.json(
      { success: false, error: { code: 'CREATE_FAILED', message: 'Failed to create journey' } },
      500,
    );
  }

  await auditLog({
    orgId: authCtx.orgId,
    userId: authCtx.userId,
    action: 'journey.create',
    entityType: 'journey',
    entityId: journey.id,
  });

  return c.json({ success: true, data: journey }, 201);
});

journeyRoutes.get('/:id', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const journey = await db.query.journeys.findFirst({
    where: and(eq(journeys.id, id), eq(journeys.orgId, authCtx.orgId)),
  });

  if (!journey) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Journey not found' } },
      404,
    );
  }

  const rawSegments = await db.query.journeySegments.findMany({
    where: eq(journeySegments.journeyId, journey.id),
    orderBy: [asc(journeySegments.segmentOrder)],
  });

  const segments = [];
  for (const seg of rawSegments) {
    const flight = await db.query.flights.findFirst({ where: eq(flights.id, seg.flightId) });
    segments.push({
      ...seg,
      flightNumber: flight?.flightNumber ?? 'UNKNOWN',
      status: flight?.status ?? 'unknown',
    });
  }

  return c.json({
    success: true,
    data: { ...journey, flightSegments: segments },
  });
});

journeyRoutes.post('/:id/flights', requirePermission(PERMISSIONS.BAGGAGE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();

  const journey = await db.query.journeys.findFirst({
    where: and(eq(journeys.id, id), eq(journeys.orgId, authCtx.orgId)),
  });

  if (!journey) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Journey not found' } },
      404,
    );
  }

  const existingSegs = await db.query.journeySegments.findMany({
    where: eq(journeySegments.journeyId, id),
  });

  const nextOrder = existingSegs.length;

  const [segment] = await db.insert(journeySegments).values({
    orgId: authCtx.orgId,
    journeyId: id,
    flightId: body.flightId,
    segmentOrder: nextOrder,
  }).returning();

  return c.json({ success: true, data: segment }, 201);
});
