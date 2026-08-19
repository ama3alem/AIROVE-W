import { Hono } from 'hono';
import { PERMISSIONS } from '@airove/shared';
import { createRecoveryPlanSchema, updateRecoveryPlanSchema, approveRecoveryPlanSchema } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import { recoveryService } from '../lib/recovery-service';
import type { AppEnv } from '../types/env';

export const recoveryPlanRoutes = new Hono<AppEnv>();

recoveryPlanRoutes.use('*', rateLimiter({ maxRequests: 60 }));
recoveryPlanRoutes.use('*', authMiddleware);

recoveryPlanRoutes.get('/', requirePermission(PERMISSIONS.RECOVERY_PLAN_READ), async (c) => {
  const authCtx = c.get('auth');
  const query = c.req.query();
  const page = parseInt(query['page'] ?? '1', 10);
  const pageSize = parseInt(query['pageSize'] ?? '20', 10);

  const result = await recoveryService.listPlans(authCtx.orgId, {
    status: query['status'] as string | undefined,
    recoveryType: query['recoveryType'] as string | undefined,
    caseId: query['caseId'] as string | undefined,
    baggageId: query['baggageId'] as string | undefined,
    page,
    pageSize,
  });

  return c.json({ success: true, data: result });
});

recoveryPlanRoutes.get('/:planId', requirePermission(PERMISSIONS.RECOVERY_PLAN_READ), async (c) => {
  const authCtx = c.get('auth');
  const planId = c.req.param('planId');
  const plan = await recoveryService.getPlan(planId, authCtx.orgId);
  return c.json({ success: true, data: plan });
});

recoveryPlanRoutes.post('/', requirePermission(PERMISSIONS.RECOVERY_PLAN_CREATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createRecoveryPlanSchema.parse(body);

  const plan = await recoveryService.createPlan(
    {
      caseId: validated.caseId,
      baggageId: validated.baggageId,
      recoveryType: validated.recoveryType,
      origin: validated.origin,
      destination: validated.destination,
      currentLocation: validated.currentLocation,
      metadata: validated.metadata,
    },
    authCtx.orgId,
    authCtx.userId,
  );

  return c.json({ success: true, data: plan }, 201);
});

recoveryPlanRoutes.put('/:planId', requirePermission(PERMISSIONS.RECOVERY_PLAN_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const planId = c.req.param('planId');
  const body = await c.req.json();
  const validated = updateRecoveryPlanSchema.parse(body);

  const plan = await recoveryService.updatePlan(planId, authCtx.orgId, validated, authCtx.userId);
  return c.json({ success: true, data: plan });
});

recoveryPlanRoutes.post('/:planId/approve', requirePermission(PERMISSIONS.RECOVERY_PLAN_APPROVE), async (c) => {
  const authCtx = c.get('auth');
  const planId = c.req.param('planId');
  const body = await c.req.json();
  const validated = approveRecoveryPlanSchema.parse(body);

  const plan = await recoveryService.transitionPlan(
    planId,
    authCtx.orgId,
    validated.status,
    authCtx.userId,
  );

  return c.json({ success: true, data: plan });
});

recoveryPlanRoutes.post('/:planId/execute', requirePermission(PERMISSIONS.RECOVERY_PLAN_EXECUTE), async (c) => {
  const authCtx = c.get('auth');
  const planId = c.req.param('planId');

  const plan = await recoveryService.transitionPlan(
    planId,
    authCtx.orgId,
    'executing',
    authCtx.userId,
  );

  return c.json({ success: true, data: plan });
});

recoveryPlanRoutes.get('/:planId/versions', requirePermission(PERMISSIONS.RECOVERY_PLAN_READ), async (c) => {
  const authCtx = c.get('auth');
  const planId = c.req.param('planId');
  const versions = await recoveryService.getVersions(planId, authCtx.orgId);
  return c.json({ success: true, data: versions });
});
