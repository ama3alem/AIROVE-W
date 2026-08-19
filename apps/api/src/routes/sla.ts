import { Hono } from 'hono';
import { PERMISSIONS } from '@airove/shared';
import { createSLAPolicySchema, updateSLAPolicySchema, pauseSLASchema } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import { slaService } from '../lib/sla-engine';
import { caseActivityService } from '../lib/case-activity-service';
import type { AppEnv } from '../types/env';

export const slaRoutes = new Hono<AppEnv>();

slaRoutes.use('*', rateLimiter({ maxRequests: 60 }));
slaRoutes.use('*', authMiddleware);

slaRoutes.get('/', requirePermission(PERMISSIONS.CASE_READ), async (c) => {
  const authCtx = c.get('auth');

  try {
    const policies = await slaService.listSLAPolicies(authCtx.orgId);
    return c.json({ success: true, data: policies });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { success: false, error: { code: 'SLA_LIST_FAILED', message } },
      500,
    );
  }
});

slaRoutes.post('/', requirePermission(PERMISSIONS.CASE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createSLAPolicySchema.parse(body);

  try {
    const policy = await slaService.createSLAPolicy(
      {
        name: validated.name,
        description: validated.description,
        caseType: validated.caseType,
        priority: validated.priority,
        responseMinutes: validated.responseMinutes,
        resolutionMinutes: validated.resolutionMinutes,
        warningThresholdPercent: validated.warningThresholdPercent,
        escalationThresholdPercent: validated.escalationThresholdPercent,
        pauseOnPendingExternal: validated.pauseOnPendingExternal,
      },
      authCtx.orgId,
    );

    return c.json({ success: true, data: policy }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { success: false, error: { code: 'SLA_CREATE_FAILED', message } },
      500,
    );
  }
});

slaRoutes.get('/:id', requirePermission(PERMISSIONS.CASE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  try {
    const policy = await slaService.getSLAPolicy(id, authCtx.orgId);
    if (!policy) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'SLA policy not found' } },
        404,
      );
    }

    return c.json({ success: true, data: policy });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { success: false, error: { code: 'SLA_FETCH_FAILED', message } },
      500,
    );
  }
});

slaRoutes.patch('/:id', requirePermission(PERMISSIONS.CASE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = updateSLAPolicySchema.parse(body);

  try {
    const updated = await slaService.updateSLAPolicy(id, authCtx.orgId, {
      name: validated.name,
      description: validated.description,
      responseMinutes: validated.responseMinutes,
      resolutionMinutes: validated.resolutionMinutes,
      warningThresholdPercent: validated.warningThresholdPercent,
      escalationThresholdPercent: validated.escalationThresholdPercent,
      pauseOnPendingExternal: validated.pauseOnPendingExternal,
      enabled: validated.enabled,
    });

    return c.json({ success: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404,
      );
    }
    return c.json(
      { success: false, error: { code: 'SLA_UPDATE_FAILED', message } },
      500,
    );
  }
});

slaRoutes.delete('/:id', requirePermission(PERMISSIONS.CASE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  try {
    const deleted = await slaService.deleteSLAPolicy(id, authCtx.orgId);
    return c.json({ success: true, data: deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404,
      );
    }
    return c.json(
      { success: false, error: { code: 'SLA_DELETE_FAILED', message } },
      500,
    );
  }
});

slaRoutes.get('/case/:caseId', requirePermission(PERMISSIONS.CASE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { caseId } = c.req.param();

  try {
    const sla = await slaService.getSLAForCase(caseId, authCtx.orgId);
    if (!sla) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No SLA found for case' } },
        404,
      );
    }

    return c.json({ success: true, data: sla });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { success: false, error: { code: 'SLA_FETCH_FAILED', message } },
      500,
    );
  }
});

slaRoutes.post('/case/:caseId/pause', requirePermission(PERMISSIONS.CASE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { caseId } = c.req.param();
  const body = await c.req.json();
  const validated = pauseSLASchema.parse(body);

  try {
    const paused = await slaService.pauseSLA(caseId, authCtx.orgId, validated.reason);

    await caseActivityService.logSLAPaused(caseId, authCtx.orgId, authCtx.userId, validated.reason);

    return c.json({ success: true, data: paused });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found') || message.includes('No SLA')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404,
      );
    }
    return c.json(
      { success: false, error: { code: 'SLA_PAUSE_FAILED', message } },
      400,
    );
  }
});

slaRoutes.post('/case/:caseId/resume', requirePermission(PERMISSIONS.CASE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { caseId } = c.req.param();

  try {
    const resumed = await slaService.resumeSLA(caseId, authCtx.orgId);

    await caseActivityService.logSLAResumed(caseId, authCtx.orgId, authCtx.userId);

    return c.json({ success: true, data: resumed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found') || message.includes('No SLA')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404,
      );
    }
    return c.json(
      { success: false, error: { code: 'SLA_RESUME_FAILED', message } },
      400,
    );
  }
});

slaRoutes.get('/case/:caseId/time-remaining', requirePermission(PERMISSIONS.CASE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { caseId } = c.req.param();

  try {
    const timeRemaining = await slaService.getSLATimeRemaining(caseId, authCtx.orgId);
    return c.json({ success: true, data: timeRemaining });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { success: false, error: { code: 'SLA_TIME_FAILED', message } },
      500,
    );
  }
});
