import { Hono } from 'hono';
import { db, tasks } from '@airove/db';
import { eq, and } from 'drizzle-orm';
import {
  createTaskSchema,
  updateTaskSchema,
  completeTaskSchema,
  blockTaskSchema,
  paginationSchema,
} from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import { taskService } from '../lib/task-engine';
import { caseActivityService } from '../lib/case-activity-service';
import type { AppEnv } from '../types/env';

export const taskRoutes = new Hono<AppEnv>();

taskRoutes.use('*', rateLimiter({ maxRequests: 60 }));
taskRoutes.use('*', authMiddleware);

taskRoutes.get('/', requirePermission(PERMISSIONS.TASK_READ), async (c) => {
  const authCtx = c.get('auth');
  const query = c.req.query();
  const page = parseInt(query['page'] ?? '1', 10);
  const pageSize = parseInt(query['pageSize'] ?? '20', 10);

  const result = await taskService.listTasks(authCtx.orgId, {
    caseId: query['caseId'] as string | undefined,
    status: query['status'] as string | undefined,
    assignedTo: query['assignedTo'] as string | undefined,
    taskType: query['taskType'] as string | undefined,
    page,
    pageSize,
  });

  return c.json({ success: true, data: result });
});

taskRoutes.post('/', requirePermission(PERMISSIONS.TASK_CREATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createTaskSchema.parse(body);

  const task = await taskService.createTask(
    {
      caseId: validated.caseId,
      baggageId: validated.baggageId,
      title: validated.title,
      description: validated.description,
      taskType: validated.taskType,
      priority: validated.priority,
      assignedTo: validated.assignedTo,
      assignedOrganizationId: validated.assignedOrganizationId,
      dueAt: validated.dueAt ? new Date(validated.dueAt) : undefined,
    },
    authCtx.orgId,
  );

  if (validated.caseId) {
    await caseActivityService.logTaskCreated(
      task.id, validated.caseId, authCtx.orgId, authCtx.userId,
    );
  }

  return c.json({ success: true, data: task }, 201);
});

taskRoutes.get('/:id', requirePermission(PERMISSIONS.TASK_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const task = await taskService.getTask(id, authCtx.orgId);
  if (!task) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
      404,
    );
  }

  return c.json({ success: true, data: task });
});

taskRoutes.patch('/:id', requirePermission(PERMISSIONS.TASK_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = updateTaskSchema.parse(body);

  const task = await taskService.getTask(id, authCtx.orgId);
  if (!task) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
      404,
    );
  }

  const updated = await taskService.updateTask(id, authCtx.orgId, {
    title: validated.title,
    description: validated.description,
    dueAt: validated.dueAt ? new Date(validated.dueAt) : undefined,
    result: validated.result,
  });

  return c.json({ success: true, data: updated });
});

taskRoutes.post('/:id/assign', requirePermission(PERMISSIONS.TASK_ASSIGN), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();
  const { assignedTo, assignedOrganizationId } = body as {
    assignedTo: string;
    assignedOrganizationId?: string;
  };

  const task = await taskService.getTask(id, authCtx.orgId);
  if (!task) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
      404,
    );
  }

  const updated = await taskService.assignTask(id, authCtx.orgId, assignedTo, assignedOrganizationId);

  if (task.caseId) {
    await caseActivityService.logTaskAssigned(
      id, task.caseId, authCtx.orgId, authCtx.userId, assignedTo,
    );
  }

  return c.json({ success: true, data: updated });
});

taskRoutes.post('/:id/start', requirePermission(PERMISSIONS.TASK_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const task = await taskService.getTask(id, authCtx.orgId);
  if (!task) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
      404,
    );
  }

  const updated = await taskService.startTask(id, authCtx.orgId);
  return c.json({ success: true, data: updated });
});

taskRoutes.post('/:id/complete', requirePermission(PERMISSIONS.TASK_COMPLETE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = completeTaskSchema.parse(body);

  const task = await taskService.getTask(id, authCtx.orgId);
  if (!task) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
      404,
    );
  }

  const updated = await taskService.completeTask(id, authCtx.orgId, authCtx.userId, validated.result);

  if (task.caseId) {
    await caseActivityService.logTaskCompleted(id, task.caseId, authCtx.orgId, authCtx.userId);
  }

  return c.json({ success: true, data: updated });
});

taskRoutes.post('/:id/block', requirePermission(PERMISSIONS.TASK_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = blockTaskSchema.parse(body);

  const task = await taskService.getTask(id, authCtx.orgId);
  if (!task) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
      404,
    );
  }

  const updated = await taskService.blockTask(id, authCtx.orgId, validated.reason);
  return c.json({ success: true, data: updated });
});

taskRoutes.post('/:id/cancel', requirePermission(PERMISSIONS.TASK_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const task = await taskService.getTask(id, authCtx.orgId);
  if (!task) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } },
      404,
    );
  }

  const updated = await taskService.cancelTask(id, authCtx.orgId);
  return c.json({ success: true, data: updated });
});
