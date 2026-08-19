import { db, tasks } from '@airove/db';
import { eq, and, sql, desc } from 'drizzle-orm';
import pino from 'pino';
import { auditLog } from './audit-logger.js';
import { validateTaskTransition } from './case-state-machine.js';

const logger = pino({ name: 'layer5-task-engine' });

export interface CreateTaskInput {
  caseId?: string;
  baggageId?: string;
  title: string;
  description?: string;
  taskType: string;
  priority?: string;
  assignedTo?: string;
  assignedOrganizationId?: string;
  dueAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ListTaskFilters {
  caseId?: string;
  status?: string;
  assignedTo?: string;
  taskType?: string;
  page?: number;
  pageSize?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: string;
  taskType?: string;
  dueAt?: Date;
  result?: string;
  metadata?: Record<string, unknown>;
}

export class TaskService {
  async createTask(input: CreateTaskInput, orgId: string) {
    const hasAssignee = !!input.assignedTo;
    const result = await db
      .insert(tasks)
      .values({
        orgId,
        caseId: input.caseId ?? null,
        baggageId: input.baggageId ?? null,
        title: input.title,
        description: input.description ?? null,
        taskType: input.taskType,
        priority: input.priority ?? 'medium',
        status: hasAssignee ? 'assigned' : 'pending',
        assignedTo: input.assignedTo ?? null,
        assignedOrganizationId: input.assignedOrganizationId ?? null,
        assignedAt: hasAssignee ? new Date() : null,
        dueAt: input.dueAt ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      })
      .returning();

    const task = result[0];
    if (!task) {
      throw new Error('Failed to create task');
    }

    await auditLog({
      orgId,
      action: 'task.create',
      entityType: 'task',
      entityId: task.id,
      entityRef: input.title,
    });

    logger.info({ taskId: task.id, caseId: input.caseId, taskType: input.taskType }, 'Task created');
    return task;
  }

  async getTask(taskId: string, orgId: string) {
    return db.query.tasks.findFirst({
      where: and(eq(tasks.id, taskId), eq(tasks.orgId, orgId)),
    });
  }

  async listTasks(orgId: string, filters: ListTaskFilters) {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 25, 100);
    const offset = (page - 1) * pageSize;

    const conditions = [eq(tasks.orgId, orgId)];
    if (filters.caseId) conditions.push(eq(tasks.caseId, filters.caseId));
    if (filters.status) conditions.push(eq(tasks.status, filters.status));
    if (filters.assignedTo) conditions.push(eq(tasks.assignedTo, filters.assignedTo));
    if (filters.taskType) conditions.push(eq(tasks.taskType, filters.taskType));

    const where = and(...conditions);

    const [items, countResult] = await Promise.all([
      db.query.tasks.findMany({
        where,
        orderBy: [desc(tasks.createdAt)],
        limit: pageSize,
        offset,
      }),
      db.execute<{ count: string }>(
        sql`SELECT COUNT(*)::text as count FROM tasks WHERE ${where}`,
      ),
    ]);

    const total = parseInt(countResult[0]?.count ?? '0', 10);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateTask(taskId: string, orgId: string, updates: UpdateTaskInput) {
    const existing = await this.getTask(taskId, orgId);
    if (!existing) {
      throw new Error('Task not found');
    }

    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.title !== undefined) setValues['title'] = updates.title;
    if (updates.description !== undefined) setValues['description'] = updates.description;
    if (updates.priority !== undefined) setValues['priority'] = updates.priority;
    if (updates.taskType !== undefined) setValues['taskType'] = updates.taskType;
    if (updates.dueAt !== undefined) setValues['dueAt'] = updates.dueAt;
    if (updates.result !== undefined) setValues['result'] = updates.result;
    if (updates.metadata !== undefined) {
      setValues['metadata'] = JSON.stringify(updates.metadata);
    }

    const [updated] = await db
      .update(tasks)
      .set(setValues)
      .where(and(eq(tasks.id, taskId), eq(tasks.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to update task');
    }

    logger.info({ taskId, changes: Object.keys(updates) }, 'Task updated');
    return updated;
  }

  async assignTask(
    taskId: string,
    orgId: string,
    assignedTo: string,
    assignedOrgId?: string,
  ) {
    const existing = await this.getTask(taskId, orgId);
    if (!existing) {
      throw new Error('Task not found');
    }

    const validation = validateTaskTransition(existing.status, 'assigned');
    if (!validation.allowed) {
      throw new Error(validation.reason);
    }

    const [updated] = await db
      .update(tasks)
      .set({
        assignedTo,
        assignedOrganizationId: assignedOrgId ?? null,
        status: 'assigned',
        assignedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to assign task');
    }

    await auditLog({
      orgId,
      action: 'task.assign',
      entityType: 'task',
      entityId: taskId,
      entityRef: existing.title,
      changes: JSON.stringify({ assignedTo }),
    });

    logger.info({ taskId, assignedTo }, 'Task assigned');
    return updated;
  }

  async startTask(taskId: string, orgId: string) {
    const existing = await this.getTask(taskId, orgId);
    if (!existing) {
      throw new Error('Task not found');
    }

    const validation = validateTaskTransition(existing.status, 'in_progress');
    if (!validation.allowed) {
      throw new Error(validation.reason);
    }

    const [updated] = await db
      .update(tasks)
      .set({
        status: 'in_progress',
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to start task');
    }

    logger.info({ taskId }, 'Task started');
    return updated;
  }

  async blockTask(taskId: string, orgId: string, reason: string) {
    const existing = await this.getTask(taskId, orgId);
    if (!existing) {
      throw new Error('Task not found');
    }

    const validation = validateTaskTransition(existing.status, 'blocked');
    if (!validation.allowed) {
      throw new Error(validation.reason);
    }

    const [updated] = await db
      .update(tasks)
      .set({
        status: 'blocked',
        blockedAt: new Date(),
        blockedReason: reason,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to block task');
    }

    await auditLog({
      orgId,
      action: 'task.block',
      entityType: 'task',
      entityId: taskId,
      entityRef: existing.title,
      changes: JSON.stringify({ reason }),
    });

    logger.info({ taskId, reason }, 'Task blocked');
    return updated;
  }

  async completeTask(taskId: string, orgId: string, userId: string, result?: string) {
    const existing = await this.getTask(taskId, orgId);
    if (!existing) {
      throw new Error('Task not found');
    }

    const validation = validateTaskTransition(existing.status, 'completed');
    if (!validation.allowed) {
      throw new Error(validation.reason);
    }

    const [updated] = await db
      .update(tasks)
      .set({
        status: 'completed',
        completedAt: new Date(),
        completedBy: userId,
        result: result ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to complete task');
    }

    await auditLog({
      orgId,
      userId,
      action: 'task.complete',
      entityType: 'task',
      entityId: taskId,
      entityRef: existing.title,
    });

    logger.info({ taskId, userId }, 'Task completed');
    return updated;
  }

  async cancelTask(taskId: string, orgId: string) {
    const existing = await this.getTask(taskId, orgId);
    if (!existing) {
      throw new Error('Task not found');
    }

    const validation = validateTaskTransition(existing.status, 'cancelled');
    if (!validation.allowed) {
      throw new Error(validation.reason);
    }

    const [updated] = await db
      .update(tasks)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to cancel task');
    }

    logger.info({ taskId }, 'Task cancelled');
    return updated;
  }

  async listTasksByCase(caseId: string, orgId: string) {
    return db.query.tasks.findMany({
      where: and(eq(tasks.caseId, caseId), eq(tasks.orgId, orgId)),
      orderBy: [desc(tasks.createdAt)],
    });
  }

  async createTasksFromTemplate(
    taskTemplates: Array<{
      title: string;
      description?: string;
      taskType: string;
      priority?: string;
      assignedTo?: string;
      assignedOrganizationId?: string;
      dueAt?: Date;
    }>,
    caseId: string,
    orgId: string,
  ) {
    const created = [];
    for (const template of taskTemplates) {
      const task = await this.createTask(
        {
          caseId,
          title: template.title,
          description: template.description,
          taskType: template.taskType,
          priority: template.priority,
          assignedTo: template.assignedTo,
          assignedOrganizationId: template.assignedOrganizationId,
          dueAt: template.dueAt,
        },
        orgId,
      );
      created.push(task);
    }

    logger.info({ caseId, count: created.length }, 'Tasks created from template');
    return created;
  }
}

export const taskService = new TaskService();
