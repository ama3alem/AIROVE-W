import { Hono } from 'hono';
import { db, baggage } from '@airove/db';
import { eq, and } from 'drizzle-orm';
import { createBaggageSchema, paginationSchema } from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import { auditLog } from '../lib/audit-logger';
import type { AppEnv } from '../types/env';

export const baggageRoutes = new Hono<AppEnv>();

baggageRoutes.use('*', rateLimiter({ maxRequests: 100 }));
baggageRoutes.use('*', authMiddleware);

baggageRoutes.get('/', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { page, pageSize } = paginationSchema.parse(c.req.query());

  const all = await db.query.baggage.findMany({
    where: eq(baggage.orgId, authCtx.orgId),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return c.json({ success: true, data: all });
});

baggageRoutes.post('/', requirePermission(PERMISSIONS.BAGGAGE_CREATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createBaggageSchema.parse(body);

  const [bag] = await db
    .insert(baggage)
    .values({
      ...validated,
      orgId: authCtx.orgId,
    })
    .returning();

  return c.json({ success: true, data: bag }, 201);
});

baggageRoutes.get('/:id', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
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

  return c.json({ success: true, data: bag });
});

baggageRoutes.get('/tag/:tagNumber', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { tagNumber } = c.req.param();

  const bag = await db.query.baggage.findFirst({
    where: and(eq(baggage.tagNumber, tagNumber), eq(baggage.orgId, authCtx.orgId)),
  });

  if (!bag) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Baggage not found' } },
      404,
    );
  }

  return c.json({ success: true, data: bag });
});

baggageRoutes.patch('/:id', requirePermission(PERMISSIONS.BAGGAGE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();

  const [updated] = await db
    .update(baggage)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(baggage.id, id), eq(baggage.orgId, authCtx.orgId)))
    .returning();

  if (!updated) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Baggage not found' } },
      404,
    );
  }

  return c.json({ success: true, data: updated });
});
