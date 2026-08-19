import type { MiddlewareHandler } from 'hono';
import { auth } from '../lib/auth.js';
import { authorizationService, type AuthorizationContext } from '../lib/authorization.js';
import { logger } from '../lib/logger.js';
import type { AppEnv } from '../types/env.js';

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    }, 401);
  }

  const orgId = c.req.header('X-Org-Id');

  if (!orgId) {
    return c.json({
      success: false,
      error: {
        code: 'ORG_REQUIRED',
        message: 'Organization context required',
      },
    }, 400);
  }

  const context = await authorizationService.buildAuthorizationContext(
    session.user.id,
    session.session.id,
    orgId,
    c.req.header('x-forwarded-for') ?? undefined,
    c.req.header('user-agent') ?? undefined,
  );

  if (!context) {
    return c.json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Not a member of this organization',
      },
    }, 403);
  }

  c.set('auth', context);
  await next();
};

export function requirePermission(permission: string): MiddlewareHandler {
  return async (c, next) => {
    const context = c.get('auth') as AuthorizationContext | undefined;

    if (!context) {
      return c.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      }, 401);
    }

    const allowed = authorizationService.hasPermission(context, permission);

    if (!allowed) {
      logger.warn({
        userId: context.userId,
        orgId: context.orgId,
        permission,
        required: permission,
      }, 'Permission denied');

      await authorizationService.auditAuthorization(
        context,
        permission,
        'DENY',
        { requiredPermission: permission },
        c.req.header('x-forwarded-for') ?? undefined,
        c.req.header('user-agent') ?? undefined,
      );

      return c.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      }, 403);
    }

    await next();
  };
}

export function requireAnyPermission(...perms: string[]): MiddlewareHandler {
  return async (c, next) => {
    const context = c.get('auth') as AuthorizationContext | undefined;

    if (!context) {
      return c.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      }, 401);
    }

    const allowed = authorizationService.hasAnyPermission(context, perms);

    if (!allowed) {
      logger.warn({
        userId: context.userId,
        orgId: context.orgId,
        required: perms,
      }, 'Permission denied (any)');

      return c.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      }, 403);
    }

    await next();
  };
}
