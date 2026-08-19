import { Hono } from 'hono';
import { db, roles, rolePermissions, permissions, membershipRoles, orgMembers } from '@airove/db';
import { eq, and } from 'drizzle-orm';
import { createRoleSchema, assignRoleSchema, paginationSchema } from '@airove/shared';
import { PERMISSIONS, LAYER2_ROLES } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import { auditLog } from '../lib/audit-logger';
import type { AppEnv } from '../types/env';

export const roleRoutes = new Hono<AppEnv>();

roleRoutes.use('*', rateLimiter({ maxRequests: 60 }));
roleRoutes.use('*', authMiddleware);

roleRoutes.get('/', requirePermission(PERMISSIONS.ROLE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { page, pageSize } = paginationSchema.parse(c.req.query());

  const all = await db.query.roles.findMany({
    where: eq(roles.orgId, authCtx.orgId),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return c.json({ success: true, data: all });
});

roleRoutes.post('/', requirePermission(PERMISSIONS.ROLE_CREATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createRoleSchema.parse(body);

  const result = await db
    .insert(roles)
    .values({
      orgId: authCtx.orgId,
      name: validated.name,
      displayName: validated.displayName,
      description: validated.description ?? null,
    })
    .returning();

  const role = result[0];

  if (!role) {
    return c.json(
      { success: false, error: { code: 'CREATE_FAILED', message: 'Failed to create role' } },
      500,
    );
  }

  if (validated.permissionIds && validated.permissionIds.length > 0) {
    const permIds = validated.permissionIds;
    if (permIds.length > 0) {
      await db.insert(rolePermissions).values(
        permIds.map((permId) => ({
          roleId: role.id,
          permissionId: permId,
        })),
      );
    }
  }

  await auditLog({
    orgId: authCtx.orgId,
    userId: authCtx.userId,
    action: 'role.create',
    entityType: 'role',
    entityId: role.id,
    entityRef: role.name,
  });

  return c.json({ success: true, data: role }, 201);
});

roleRoutes.get('/:id', requirePermission(PERMISSIONS.ROLE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const role = await db.query.roles.findFirst({
    where: and(eq(roles.id, id), eq(roles.orgId, authCtx.orgId)),
  });

  if (!role) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Role not found' } },
      404,
    );
  }

  const rolePerms = await db.query.rolePermissions.findMany({
    where: eq(rolePermissions.roleId, role.id),
  });

  const permIds = rolePerms.map((rp) => rp.permissionId);
  const permRecords = permIds.length > 0
    ? await db.query.permissions.findMany({
        where: eq(permissions.id, permIds[0]!),
      })
    : [];

  return c.json({
    success: true,
    data: {
      ...role,
      permissions: permRecords.map((p) => p.name),
    },
  });
});

roleRoutes.delete('/:id', requirePermission(PERMISSIONS.ROLE_DELETE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const role = await db.query.roles.findFirst({
    where: and(eq(roles.id, id), eq(roles.orgId, authCtx.orgId)),
  });

  if (!role) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Role not found' } },
      404,
    );
  }

  if (role.isSystem) {
    return c.json(
      { success: false, error: { code: 'CANNOT_DELETE_SYSTEM_ROLE', message: 'Cannot delete system role' } },
      400,
    );
  }

  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
  await db.delete(roles).where(eq(roles.id, id));

  await auditLog({
    orgId: authCtx.orgId,
    userId: authCtx.userId,
    action: 'role.delete',
    entityType: 'role',
    entityId: role.id,
    entityRef: role.name,
  });

  return c.json({ success: true });
});

roleRoutes.post('/assign', requirePermission(PERMISSIONS.ROLE_GRANT), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = assignRoleSchema.parse(body);

  const targetMembership = await db.query.orgMembers.findFirst({
    where: and(
      eq(orgMembers.userId, validated.userId),
      eq(orgMembers.orgId, authCtx.orgId),
    ),
  });

  if (!targetMembership) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'User is not a member of this organization' } },
      404,
    );
  }

  const role = await db.query.roles.findFirst({
    where: and(eq(roles.id, validated.roleId), eq(roles.orgId, authCtx.orgId)),
  });

  if (!role) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Role not found' } },
      404,
    );
  }

  const existing = await db.query.membershipRoles.findFirst({
    where: and(
      eq(membershipRoles.membershipId, targetMembership.id),
      eq(membershipRoles.roleId, validated.roleId),
    ),
  });

  if (existing) {
    return c.json(
      { success: false, error: { code: 'ALREADY_ASSIGNED', message: 'Role already assigned' } },
      409,
    );
  }

  const assignmentResult = await db
    .insert(membershipRoles)
    .values({
      membershipId: targetMembership.id,
      roleId: validated.roleId,
      grantedBy: authCtx.userId,
    })
    .returning();

  const assignment = assignmentResult[0];

  if (!assignment) {
    return c.json(
      { success: false, error: { code: 'CREATE_FAILED', message: 'Failed to assign role' } },
      500,
    );
  }

  await auditLog({
    orgId: authCtx.orgId,
    userId: authCtx.userId,
    action: 'role.assign',
    entityType: 'membership_role',
    entityId: assignment.id,
    changes: JSON.stringify({ roleId: validated.roleId, userId: validated.userId }),
  });

  return c.json({ success: true, data: assignment }, 201);
});
