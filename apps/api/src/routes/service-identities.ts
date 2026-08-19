import { Hono } from 'hono';
import { db, serviceIdentities } from '@airove/db';
import { eq, and } from 'drizzle-orm';
import { createServiceIdentitySchema, paginationSchema } from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { auditLog } from '../lib/audit-logger.js';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import type { AppEnv } from '../types/env.js';

export const serviceIdentityRoutes = new Hono<AppEnv>();

serviceIdentityRoutes.use('*', rateLimiter({ maxRequests: 30 }));
serviceIdentityRoutes.use('*', authMiddleware);

serviceIdentityRoutes.get('/', requirePermission(PERMISSIONS.SERVICE_IDENTITY_READ), async (c) => {
  const authCtx = c.get('auth');
  const { page, pageSize } = paginationSchema.parse(c.req.query());

  const all = await db.query.serviceIdentities.findMany({
    where: eq(serviceIdentities.orgId, authCtx.orgId),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const safe = all.map((si) => ({
    ...si,
    apiKeyHash: undefined,
  }));

  return c.json({ success: true, data: safe });
});

serviceIdentityRoutes.post('/', requirePermission(PERMISSIONS.SERVICE_IDENTITY_CREATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createServiceIdentitySchema.parse(body);

  const rawKey = `airove_${nanoid(32)}`;
  const apiKeyHash = createHash('sha256').update(rawKey).digest('hex');

  const siResult = await db
    .insert(serviceIdentities)
    .values({
      orgId: authCtx.orgId,
      name: validated.name,
      type: validated.type,
      apiKeyHash,
      permissions: validated.permissions ? JSON.stringify(validated.permissions) : null,
      rateLimit: validated.rateLimit ?? 1000,
      expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
    })
    .returning();

  const serviceIdentity = siResult[0];

  if (!serviceIdentity) {
    return c.json(
      { success: false, error: { code: 'CREATE_FAILED', message: 'Failed to create service identity' } },
      500,
    );
  }

  await auditLog({
    orgId: authCtx.orgId,
    userId: authCtx.userId,
    action: 'service_identity.create',
    entityType: 'service_identity',
    entityId: serviceIdentity.id,
    entityRef: validated.name,
  });

  return c.json({
    success: true,
    data: {
      ...serviceIdentity,
      apiKey: rawKey,
      apiKeyHash: undefined,
    },
  }, 201);
});

serviceIdentityRoutes.get('/:id', requirePermission(PERMISSIONS.SERVICE_IDENTITY_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const si = await db.query.serviceIdentities.findFirst({
    where: and(eq(serviceIdentities.id, id), eq(serviceIdentities.orgId, authCtx.orgId)),
  });

  if (!si) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Service identity not found' } },
      404,
    );
  }

  return c.json({
    success: true,
    data: { ...si, apiKeyHash: undefined },
  });
});

serviceIdentityRoutes.delete('/:id', requirePermission(PERMISSIONS.SERVICE_IDENTITY_DELETE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const si = await db.query.serviceIdentities.findFirst({
    where: and(eq(serviceIdentities.id, id), eq(serviceIdentities.orgId, authCtx.orgId)),
  });

  if (!si) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Service identity not found' } },
      404,
    );
  }

  await db.delete(serviceIdentities).where(eq(serviceIdentities.id, id));

  await auditLog({
    orgId: authCtx.orgId,
    userId: authCtx.userId,
    action: 'service_identity.delete',
    entityType: 'service_identity',
    entityId: si.id,
    entityRef: si.name,
  });

  return c.json({ success: true });
});
