import { Hono } from 'hono';
import { db, users, orgMembers, membershipRoles } from '@airove/db';
import { eq, and } from 'drizzle-orm';
import { updateMembershipSchema, paginationSchema } from '@airove/shared';
import { PERMISSIONS, LAYER2_ROLES } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { auditLog } from '../lib/audit-logger.js';
import type { AppEnv } from '../types/env.js';

export const userManagementRoutes = new Hono<AppEnv>();

userManagementRoutes.use('*', rateLimiter({ maxRequests: 60 }));
userManagementRoutes.use('*', authMiddleware);

userManagementRoutes.get('/', requirePermission(PERMISSIONS.USER_READ), async (c) => {
  const authCtx = c.get('auth');
  const { page, pageSize } = paginationSchema.parse(c.req.query());

  const memberships = await db.query.orgMembers.findMany({
    where: eq(orgMembers.orgId, authCtx.orgId),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const userIds = memberships.map((m) => m.userId);
  const userList = userIds.length > 0
    ? await db.query.users.findMany({
        where: eq(users.id, userIds[0]!),
      })
    : [];

  return c.json({ success: true, data: userList });
});

userManagementRoutes.get('/:userId', requirePermission(PERMISSIONS.USER_READ), async (c) => {
  const authCtx = c.get('auth');
  const { userId } = c.req.param();

  const membership = await db.query.orgMembers.findFirst({
    where: and(
      eq(orgMembers.userId, userId),
      eq(orgMembers.orgId, authCtx.orgId),
    ),
  });

  if (!membership) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'User not found in organization' } },
      404,
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  return c.json({ success: true, data: { ...user, membership } });
});

userManagementRoutes.patch(
  '/:userId/membership',
  requirePermission(PERMISSIONS.USER_UPDATE),
  async (c) => {
    const authCtx = c.get('auth');
    const { userId } = c.req.param();
    const body = await c.req.json();
    const validated = updateMembershipSchema.parse(body);

    if (userId === authCtx.userId) {
      return c.json(
        { success: false, error: { code: 'SELF_MODIFICATION', message: 'Cannot modify your own membership' } },
        400,
      );
    }

    const [updated] = await db
      .update(orgMembers)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orgMembers.userId, userId),
          eq(orgMembers.orgId, authCtx.orgId),
        ),
      )
      .returning();

    if (!updated) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Membership not found' } },
        404,
      );
    }

    await auditLog({
      orgId: authCtx.orgId,
      userId: authCtx.userId,
      action: 'membership.update',
      entityType: 'membership',
      entityId: updated.id,
      changes: JSON.stringify(validated),
    });

    return c.json({ success: true, data: updated });
  },
);

userManagementRoutes.post(
  '/:userId/suspend',
  requirePermission(PERMISSIONS.USER_SUSPEND),
  async (c) => {
    const authCtx = c.get('auth');
    const { userId } = c.req.param();

    if (userId === authCtx.userId) {
      return c.json(
        { success: false, error: { code: 'SELF_MODIFICATION', message: 'Cannot suspend yourself' } },
        400,
      );
    }

    const [updated] = await db
      .update(orgMembers)
      .set({ status: 'suspended', updatedAt: new Date() })
      .where(
        and(
          eq(orgMembers.userId, userId),
          eq(orgMembers.orgId, authCtx.orgId),
        ),
      )
      .returning();

    if (!updated) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Membership not found' } },
        404,
      );
    }

    await auditLog({
      orgId: authCtx.orgId,
      userId: authCtx.userId,
      action: 'membership.suspend',
      entityType: 'membership',
      entityId: updated.id,
    });

    return c.json({ success: true, data: { status: 'suspended' } });
  },
);

userManagementRoutes.post(
  '/:userId/revoke',
  requirePermission(PERMISSIONS.USER_SUSPEND),
  async (c) => {
    const authCtx = c.get('auth');
    const { userId } = c.req.param();

    if (userId === authCtx.userId) {
      return c.json(
        { success: false, error: { code: 'SELF_MODIFICATION', message: 'Cannot revoke your own membership' } },
        400,
      );
    }

    const [updated] = await db
      .update(orgMembers)
      .set({ status: 'revoked', updatedAt: new Date() })
      .where(
        and(
          eq(orgMembers.userId, userId),
          eq(orgMembers.orgId, authCtx.orgId),
        ),
      )
      .returning();

    if (!updated) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Membership not found' } },
        404,
      );
    }

    await db.delete(membershipRoles).where(eq(membershipRoles.membershipId, updated.id));

    await auditLog({
      orgId: authCtx.orgId,
      userId: authCtx.userId,
      action: 'membership.revoke',
      entityType: 'membership',
      entityId: updated.id,
    });

    return c.json({ success: true, data: { status: 'revoked' } });
  },
);
