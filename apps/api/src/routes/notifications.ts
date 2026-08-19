import { Hono } from 'hono';
import { db, notifications } from '@airove/db';
import { eq, and } from 'drizzle-orm';
import { paginationSchema } from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import type { AppEnv } from '../types/env';

export const notificationRoutes = new Hono<AppEnv>();

notificationRoutes.use('*', rateLimiter({ maxRequests: 60 }));
notificationRoutes.use('*', authMiddleware);

notificationRoutes.get('/', requirePermission(PERMISSIONS.NOTIFICATION_READ), async (c) => {
  const authCtx = c.get('auth');
  const { page, pageSize } = paginationSchema.parse(c.req.query());

  const all = await db.query.notifications.findMany({
    where: and(
      eq(notifications.orgId, authCtx.orgId),
      eq(notifications.userId, authCtx.userId),
    ),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return c.json({ success: true, data: all });
});

notificationRoutes.patch('/:id/read', requirePermission(PERMISSIONS.NOTIFICATION_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const [updated] = await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.orgId, authCtx.orgId),
        eq(notifications.userId, authCtx.userId),
      ),
    )
    .returning();

  if (!updated) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } },
      404,
    );
  }

  return c.json({ success: true, data: updated });
});
