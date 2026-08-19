import { Hono } from 'hono';
import { db, auditLogs } from '@airove/db';
import { eq } from 'drizzle-orm';
import { paginationSchema } from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import type { AppEnv } from '../types/env';

export const auditRoutes = new Hono<AppEnv>();

auditRoutes.use('*', rateLimiter({ maxRequests: 30 }));
auditRoutes.use('*', authMiddleware);

auditRoutes.get('/', requirePermission(PERMISSIONS.AUDIT_READ), async (c) => {
  const authCtx = c.get('auth');
  const { page, pageSize } = paginationSchema.parse(c.req.query());

  const all = await db.query.auditLogs.findMany({
    where: eq(auditLogs.orgId, authCtx.orgId),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return c.json({ success: true, data: all });
});
