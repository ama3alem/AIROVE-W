import { Hono } from 'hono';
import { db, flights } from '@airove/db';
import { eq, and } from 'drizzle-orm';
import { createFlightSchema, paginationSchema } from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import type { AppEnv } from '../types/env.js';

export const flightRoutes = new Hono<AppEnv>();

flightRoutes.use('*', rateLimiter({ maxRequests: 60 }));
flightRoutes.use('*', authMiddleware);

flightRoutes.get('/', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { page, pageSize } = paginationSchema.parse(c.req.query());

  const all = await db.query.flights.findMany({
    where: eq(flights.orgId, authCtx.orgId),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return c.json({ success: true, data: all });
});

flightRoutes.post('/', requirePermission(PERMISSIONS.BAGGAGE_CREATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createFlightSchema.parse(body);

  const data = {
    orgId: authCtx.orgId,
    flightNumber: validated.flightNumber,
    status: validated.status,
    airlineId: validated.airlineId,
    departureAirportId: validated.departureAirportId,
    arrivalAirportId: validated.arrivalAirportId,
    scheduledDeparture: validated.scheduledDeparture ? new Date(validated.scheduledDeparture) : undefined,
    scheduledArrival: validated.scheduledArrival ? new Date(validated.scheduledArrival) : undefined,
    flightDate: validated.flightDate,
    tailNumber: validated.tailNumber,
    aircraftType: validated.aircraftType,
  };

  const [flight] = await db.insert(flights).values(data).returning();

  return c.json({ success: true, data: flight }, 201);
});

flightRoutes.get('/:id', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const flight = await db.query.flights.findFirst({
    where: and(eq(flights.id, id), eq(flights.orgId, authCtx.orgId)),
  });

  if (!flight) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Flight not found' } },
      404,
    );
  }

  return c.json({ success: true, data: flight });
});

flightRoutes.patch('/:id', requirePermission(PERMISSIONS.BAGGAGE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();

  const [updated] = await db
    .update(flights)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(flights.id, id), eq(flights.orgId, authCtx.orgId)))
    .returning();

  if (!updated) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Flight not found' } },
      404,
    );
  }

  return c.json({ success: true, data: updated });
});
