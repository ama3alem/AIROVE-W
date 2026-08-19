import { Hono } from 'hono';
import { db, airports } from '@airove/db';
import { eq, and } from 'drizzle-orm';
import { createAirportSchema, paginationSchema } from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import type { AppEnv } from '../types/env.js';

export const airportRoutes = new Hono<AppEnv>();

airportRoutes.use('*', rateLimiter({ maxRequests: 60 }));
airportRoutes.use('*', authMiddleware);

airportRoutes.get('/', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { page, pageSize } = paginationSchema.parse(c.req.query());

  const all = await db.query.airports.findMany({
    where: eq(airports.orgId, authCtx.orgId),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return c.json({ success: true, data: all });
});

airportRoutes.post('/', requirePermission(PERMISSIONS.ORG_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createAirportSchema.parse(body);

  const [airport] = await db
    .insert(airports)
    .values({
      ...validated,
      orgId: authCtx.orgId,
    })
    .returning();

  return c.json({ success: true, data: airport }, 201);
});

airportRoutes.get('/:id', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const airport = await db.query.airports.findFirst({
    where: and(eq(airports.id, id), eq(airports.orgId, authCtx.orgId)),
  });

  if (!airport) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Airport not found' } },
      404,
    );
  }

  return c.json({ success: true, data: airport });
});
