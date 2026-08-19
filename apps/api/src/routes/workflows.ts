import { Hono } from 'hono';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import { workflowEngine } from '../lib/workflow-engine';
import type { AppEnv } from '../types/env';

export const workflowRoutes = new Hono<AppEnv>();

workflowRoutes.use('*', rateLimiter({ maxRequests: 60 }));
workflowRoutes.use('*', authMiddleware);

workflowRoutes.get('/', requirePermission(PERMISSIONS.CASE_READ), async (c) => {
  const authCtx = c.get('auth');

  try {
    const workflows = await workflowEngine.listWorkflows(authCtx.orgId);
    return c.json({ success: true, data: workflows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { success: false, error: { code: 'WORKFLOW_LIST_FAILED', message } },
      500,
    );
  }
});

workflowRoutes.post('/', requirePermission(PERMISSIONS.CASE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const { name, description, triggerType, triggerConfig, metadata } = body as {
    name: string;
    description?: string;
    triggerType: string;
    triggerConfig?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };

  try {
    const workflow = await workflowEngine.createWorkflow(
      { name, description, triggerType, triggerConfig, metadata },
      authCtx.orgId,
    );

    return c.json({ success: true, data: workflow }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { success: false, error: { code: 'WORKFLOW_CREATE_FAILED', message } },
      500,
    );
  }
});

workflowRoutes.get('/:id', requirePermission(PERMISSIONS.CASE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  try {
    const workflow = await workflowEngine.getWorkflow(id, authCtx.orgId);
    if (!workflow) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Workflow not found' } },
        404,
      );
    }

    return c.json({ success: true, data: workflow });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { success: false, error: { code: 'WORKFLOW_FETCH_FAILED', message } },
      500,
    );
  }
});

workflowRoutes.patch('/:id', requirePermission(PERMISSIONS.CASE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();
  const { name, description, triggerType, triggerConfig, metadata } = body as {
    name?: string;
    description?: string;
    triggerType?: string;
    triggerConfig?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };

  try {
    const updated = await workflowEngine.updateWorkflow(id, authCtx.orgId, {
      name,
      description,
      triggerType,
      triggerConfig,
      metadata,
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
      { success: false, error: { code: 'WORKFLOW_UPDATE_FAILED', message } },
      500,
    );
  }
});

workflowRoutes.post('/:id/activate', requirePermission(PERMISSIONS.CASE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  try {
    const activated = await workflowEngine.activateWorkflow(id, authCtx.orgId);
    return c.json({ success: true, data: activated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404,
      );
    }
    return c.json(
      { success: false, error: { code: 'WORKFLOW_ACTIVATE_FAILED', message } },
      500,
    );
  }
});

workflowRoutes.post('/:id/deactivate', requirePermission(PERMISSIONS.CASE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  try {
    const deactivated = await workflowEngine.deactivateWorkflow(id, authCtx.orgId);
    return c.json({ success: true, data: deactivated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404,
      );
    }
    return c.json(
      { success: false, error: { code: 'WORKFLOW_DEACTIVATE_FAILED', message } },
      500,
    );
  }
});

workflowRoutes.get('/:id/rules', requirePermission(PERMISSIONS.CASE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  try {
    const rules = await workflowEngine.listRules(id, authCtx.orgId);
    return c.json({ success: true, data: rules });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json(
      { success: false, error: { code: 'WORKFLOW_RULES_LIST_FAILED', message } },
      500,
    );
  }
});

workflowRoutes.post('/:id/rules', requirePermission(PERMISSIONS.CASE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();
  const { ruleOrder, conditionType, conditionConfig, actionType, actionConfig } = body as {
    ruleOrder?: number;
    conditionType: string;
    conditionConfig: string;
    actionType: string;
    actionConfig: string;
  };

  try {
    const rule = await workflowEngine.addRule(id, authCtx.orgId, {
      ruleOrder,
      conditionType,
      conditionConfig,
      actionType,
      actionConfig,
    });

    return c.json({ success: true, data: rule }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        404,
      );
    }
    return c.json(
      { success: false, error: { code: 'WORKFLOW_RULE_ADD_FAILED', message } },
      500,
    );
  }
});
