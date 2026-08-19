import { Hono } from 'hono';
import { db, organizations, orgMembers } from '@airove/db';
import { eq } from 'drizzle-orm';
import { createOrganizationSchema, paginationSchema } from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { auditLog } from '../lib/audit-logger.js';
import type { AppEnv } from '../types/env.js';

export const orgRoutes = new Hono<AppEnv>();

orgRoutes.use('*', rateLimiter({ maxRequests: 60 }));
orgRoutes.use('*', authMiddleware);

orgRoutes.get('/', requirePermission(PERMISSIONS.ORG_READ), async (c) => {
  const authCtx = c.get('auth');

  const memberOrgs = await db.query.orgMembers.findMany({
    where: eq(orgMembers.userId, authCtx.userId),
  });

  const orgIds = memberOrgs.map((m) => m.orgId);
  const orgs = await db.query.organizations.findMany({
    where: orgIds.length > 0 ? (orgsRef, { inArray }) => inArray(orgsRef.id, orgIds) : undefined,
  });

  return c.json({ success: true, data: orgs });
});

orgRoutes.post('/', requirePermission(PERMISSIONS.ORG_CREATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createOrganizationSchema.parse(body);

  const result = await db.insert(organizations).values(validated).returning();
  const org = result[0];

  if (!org) {
    return c.json(
      { success: false, error: { code: 'CREATE_FAILED', message: 'Failed to create organization' } },
      500,
    );
  }

  await db.insert(orgMembers).values({
    orgId: org.id,
    userId: authCtx.userId,
    role: 'airline_admin',
  });

  await auditLog({
    orgId: org.id,
    userId: authCtx.userId,
    action: 'organization.create',
    entityType: 'organization',
    entityId: org.id,
    entityRef: org.slug,
  });

  return c.json({ success: true, data: org }, 201);
});

orgRoutes.get('/:id', requirePermission(PERMISSIONS.ORG_READ), async (c) => {
  const { id } = c.req.param();
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, id),
  });

  if (!org) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } },
      404,
    );
  }

  return c.json({ success: true, data: org });
});

orgRoutes.patch('/:id', requirePermission(PERMISSIONS.ORG_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();

  const [updated] = await db
    .update(organizations)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(organizations.id, id))
    .returning();

  if (!updated) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Organization not found' } },
      404,
    );
  }

  await auditLog({
    orgId: authCtx.orgId,
    userId: authCtx.userId,
    action: 'organization.update',
    entityType: 'organization',
    entityId: id,
    changes: JSON.stringify(body),
  });

  return c.json({ success: true, data: updated });
});
