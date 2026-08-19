import { Hono } from 'hono';
import { PERMISSIONS } from '@airove/shared';
import { createEscalationSchema } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import { escalationService } from '../lib/escalation-engine';
import { caseActivityService } from '../lib/case-activity-service';
import type { AppEnv } from '../types/env';

export const escalationRoutes = new Hono<AppEnv>();

escalationRoutes.use('*', rateLimiter({ maxRequests: 60 }));
escalationRoutes.use('*', authMiddleware);

escalationRoutes.get('/', requirePermission(PERMISSIONS.CASE_READ), async (c) => {
  const authCtx = c.get('auth');

  try {
    const escalations = await escalationService.getActiveEscalations(authCtx.orgId);
    return c.json({ success: true, data: escalations });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { success: false, error: { code: 'ESCALATION_LIST_FAILED', message } },
      500,
    );
  }
});

escalationRoutes.post('/', requirePermission(PERMISSIONS.CASE_ESCALATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createEscalationSchema.parse(body);

  try {
    const escalation = await escalationService.createEscalation(
      {
        caseId: validated.caseId,
        escalationLevel: validated.escalationLevel,
        reason: validated.reason,
      },
      authCtx.orgId,
    );

    await caseActivityService.logCaseEscalated(validated.caseId, authCtx.orgId, authCtx.userId);

    return c.json({ success: true, data: escalation }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { success: false, error: { code: 'ESCALATION_CREATE_FAILED', message } },
      500,
    );
  }
});

escalationRoutes.get('/:id', requirePermission(PERMISSIONS.CASE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  try {
    const escalation = await escalationService.getEscalation(id, authCtx.orgId);
    if (!escalation) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Escalation not found' } },
        404,
      );
    }

    return c.json({ success: true, data: escalation });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { success: false, error: { code: 'ESCALATION_FETCH_FAILED', message } },
      500,
    );
  }
});

escalationRoutes.get('/case/:caseId', requirePermission(PERMISSIONS.CASE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { caseId } = c.req.param();

  try {
    const escalations = await escalationService.listEscalationsByCase(caseId, authCtx.orgId);
    return c.json({ success: true, data: escalations });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { success: false, error: { code: 'ESCALATION_LIST_FAILED', message } },
      500,
    );
  }
});

escalationRoutes.post('/:id/acknowledge', requirePermission(PERMISSIONS.CASE_ESCALATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  try {
    const acknowledged = await escalationService.acknowledgeEscalation(
      id,
      authCtx.orgId,
      authCtx.userId,
    );

    return c.json({ success: true, data: acknowledged });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404,
      );
    }
    return c.json(
      { success: false, error: { code: 'ESCALATION_ACKNOWLEDGE_FAILED', message } },
      400,
    );
  }
});

escalationRoutes.post('/:id/resolve', requirePermission(PERMISSIONS.CASE_ESCALATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  try {
    const resolved = await escalationService.resolveEscalation(
      id,
      authCtx.orgId,
      authCtx.userId,
    );

    return c.json({ success: true, data: resolved });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404,
      );
    }
    return c.json(
      { success: false, error: { code: 'ESCALATION_RESOLVE_FAILED', message } },
      400,
    );
  }
});

escalationRoutes.post('/auto-escalate', requirePermission(PERMISSIONS.CASE_ESCALATE), async (c) => {
  const authCtx = c.get('auth');

  if (!authCtx.isSuperAdmin) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Super admin access required' } },
      403,
    );
  }

  try {
    const escalated = await escalationService.autoEscalate(authCtx.orgId);
    return c.json({ success: true, data: { escalated, count: escalated.length } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { success: false, error: { code: 'AUTO_ESCALATE_FAILED', message } },
      500,
    );
  }
});
