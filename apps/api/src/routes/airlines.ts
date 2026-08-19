import { Hono } from 'hono';
import { db, airlines } from '@airove/db';
import { eq, and } from 'drizzle-orm';
import { createAirlineSchema, paginationSchema } from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import type { AppEnv } from '../types/env';

export const airlineRoutes = new Hono<AppEnv>();

airlineRoutes.use('*', rateLimiter({ maxRequests: 60 }));
airlineRoutes.use('*', authMiddleware);

airlineRoutes.get('/', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { page, pageSize } = paginationSchema.parse(c.req.query());

  const all = await db.query.airlines.findMany({
    where: eq(airlines.orgId, authCtx.orgId),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return c.json({ success: true, data: all });
});

airlineRoutes.post('/', requirePermission(PERMISSIONS.ORG_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createAirlineSchema.parse(body);

  const [airline] = await db
    .insert(airlines)
    .values({
      ...validated,
      orgId: authCtx.orgId,
    })
    .returning();

  return c.json({ success: true, data: airline }, 201);
});

airlineRoutes.get('/:id', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const airline = await db.query.airlines.findFirst({
    where: and(eq(airlines.id, id), eq(airlines.orgId, authCtx.orgId)),
  });

  if (!airline) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Airline not found' } },
      404,
    );
  }

  return c.json({ success: true, data: airline });
});
