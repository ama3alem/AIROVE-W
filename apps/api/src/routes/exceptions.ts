import { Hono } from 'hono';
import { db } from '@airove/db';
import { eq, and } from 'drizzle-orm';
import { paginationSchema } from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import { exceptionService } from '../lib/exception-service';
import type { AppEnv } from '../types/env';

export const exceptionRoutes = new Hono<AppEnv>();

exceptionRoutes.use('*', rateLimiter({ maxRequests: 60 }));
exceptionRoutes.use('*', authMiddleware);

exceptionRoutes.get('/', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const unresolvedOnly = c.req.query('unresolved') === 'true';

  if (unresolvedOnly) {
    const exceptions = await exceptionService.listUnresolved(authCtx.orgId);
    return c.json({ success: true, data: exceptions });
  }

  const type = c.req.query('type');
  if (type) {
    const exceptions = await exceptionService.listByType(authCtx.orgId, type as 'expected_event_missing');
    return c.json({ success: true, data: exceptions });
  }

  const exceptions = await exceptionService.listUnresolved(authCtx.orgId);
  return c.json({ success: true, data: exceptions });
});

exceptionRoutes.post('/:id/resolve', requirePermission(PERMISSIONS.BAGGAGE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();

  const resolved = await exceptionService.resolveException({
    exceptionId: id,
    orgId: authCtx.orgId,
    resolvedBy: authCtx.userId,
    resolution: body.resolution,
  });

  if (!resolved) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Exception not found' } },
      404,
    );
  }

  return c.json({ success: true, data: resolved });
});

exceptionRoutes.get('/:id', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const exception = await exceptionService.getById(id, authCtx.orgId);
  if (!exception) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Exception not found' } },
      404,
    );
  }

  return c.json({ success: true, data: exception });
});

exceptionRoutes.get('/baggage/:baggageId', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { baggageId } = c.req.param();

  const exceptions = await exceptionService.listByBaggage(baggageId, authCtx.orgId);
  return c.json({ success: true, data: exceptions });
});
