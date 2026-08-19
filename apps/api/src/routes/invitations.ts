import { Hono } from 'hono';
import { db, invitations, orgMembers } from '@airove/db';
import { eq, and } from 'drizzle-orm';
import { inviteUserSchema, paginationSchema } from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { auditLog } from '../lib/audit-logger.js';
import { nanoid } from 'nanoid';
import type { AppEnv } from '../types/env.js';

export const invitationRoutes = new Hono<AppEnv>();

invitationRoutes.use('*', rateLimiter({ maxRequests: 30 }));
invitationRoutes.use('*', authMiddleware);

invitationRoutes.get('/', requirePermission(PERMISSIONS.INVITATION_READ), async (c) => {
  const authCtx = c.get('auth');
  const { page, pageSize } = paginationSchema.parse(c.req.query());

  const all = await db.query.invitations.findMany({
    where: eq(invitations.orgId, authCtx.orgId),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return c.json({ success: true, data: all });
});

invitationRoutes.post('/', requirePermission(PERMISSIONS.INVITATION_CREATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = inviteUserSchema.parse(body);

  const existing = await db.query.orgMembers.findFirst({
    where: and(
      eq(orgMembers.orgId, authCtx.orgId),
      eq(orgMembers.userId, validated.email),
    ),
  });

  const pendingInvite = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.orgId, authCtx.orgId),
      eq(invitations.email, validated.email),
      eq(invitations.status, 'pending'),
    ),
  });

  if (pendingInvite) {
    return c.json(
      { success: false, error: { code: 'ALREADY_INVITED', message: 'User already has a pending invitation' } },
      409,
    );
  }

  const token = nanoid(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const inviteResult = await db
    .insert(invitations)
    .values({
      orgId: authCtx.orgId,
      email: validated.email,
      role: validated.role,
      invitedBy: authCtx.userId,
      token,
      expiresAt,
    })
    .returning();

  const invitation = inviteResult[0];

  if (!invitation) {
    return c.json(
      { success: false, error: { code: 'CREATE_FAILED', message: 'Failed to create invitation' } },
      500,
    );
  }

  await auditLog({
    orgId: authCtx.orgId,
    userId: authCtx.userId,
    action: 'invitation.create',
    entityType: 'invitation',
    entityId: invitation.id,
    entityRef: validated.email,
    changes: JSON.stringify({ role: validated.role }),
  });

  return c.json({ success: true, data: { id: invitation.id, token } }, 201);
});

invitationRoutes.post('/accept', async (c) => {
  const body = await c.req.json();
  const { token } = body as { token: string };

  if (!token) {
    return c.json(
      { success: false, error: { code: 'TOKEN_REQUIRED', message: 'Invitation token required' } },
      400,
    );
  }

  const found = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
  });

  if (!found) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Invitation not found' } },
      404,
    );
  }

  const invitation = found;

  if (invitation.status !== 'pending') {
    return c.json(
      { success: false, error: { code: 'INVALID_STATUS', message: 'Invitation is no longer pending' } },
      400,
    );
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    await db
      .update(invitations)
      .set({ status: 'expired' })
      .where(eq(invitations.id, invitation.id));

    return c.json(
      { success: false, error: { code: 'EXPIRED', message: 'Invitation has expired' } },
      400,
    );
  }

  const session = await (await import('../lib/auth.js')).auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Must be signed in to accept invitation' } },
      401,
    );
  }

  if (session.user.email !== invitation.email) {
    return c.json(
      { success: false, error: { code: 'EMAIL_MISMATCH', message: 'Invitation email does not match signed-in user' } },
      400,
    );
  }

  const existingMembership = await db.query.orgMembers.findFirst({
    where: and(
      eq(orgMembers.userId, session.user.id),
      eq(orgMembers.orgId, invitation.orgId),
    ),
  });

  if (existingMembership) {
    await db
      .update(invitations)
      .set({ status: 'accepted', acceptedAt: new Date() })
      .where(eq(invitations.id, invitation.id));

    return c.json(
      { success: false, error: { code: 'ALREADY_MEMBER', message: 'User is already a member of this organization' } },
      409,
    );
  }

  const membershipResult = await db
    .insert(orgMembers)
    .values({
      orgId: invitation.orgId,
      userId: session.user.id,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
    })
    .returning();

  const membership = membershipResult[0];

  if (!membership) {
    return c.json(
      { success: false, error: { code: 'CREATE_FAILED', message: 'Failed to create membership' } },
      500,
    );
  }

  await db
    .update(invitations)
    .set({ status: 'accepted', acceptedAt: new Date() })
    .where(eq(invitations.id, invitation.id));

  await auditLog({
    orgId: invitation.orgId,
    userId: session.user.id,
    action: 'invitation.accept',
    entityType: 'invitation',
    entityId: invitation.id,
    entityRef: invitation.email,
    changes: JSON.stringify({ membershipId: membership.id, role: invitation.role }),
  });

  return c.json({ success: true, data: membership });
});
