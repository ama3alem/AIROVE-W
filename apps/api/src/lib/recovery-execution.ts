import { db, recoveryExecutions, recoveryExecutionSteps, recoveryPlans } from '@airove/db';
import { eq, and, asc } from 'drizzle-orm';
import pino from 'pino';
import { auditLog } from './audit-logger';

const logger = pino({ name: 'layer6-recovery-execution' });

export interface CreateExecutionInput {
  recoveryPlanId: string;
  providerId?: string;
  maxRetries?: number;
}

export interface CreateStepInput {
  stepOrder: number;
  stepType: string;
  description: string;
}

export class RecoveryExecutionService {
  async createExecution(planId: string, orgId: string, providerId?: string, maxRetries = 3) {
    const [plan] = await db.select().from(recoveryPlans)
      .where(and(eq(recoveryPlans.id, planId), eq(recoveryPlans.orgId, orgId)));
    if (!plan) throw new Error('Recovery plan not found');

    const [execution] = await db.insert(recoveryExecutions).values({
      orgId,
      recoveryPlanId: planId,
      status: 'pending',
      providerId: providerId ?? null,
      retryCount: 0,
      maxRetries,
      metadata: null,
    }).returning();

    await auditLog({
      orgId,
      action: 'recovery_execution_created',
      entityType: 'recovery_execution',
      entityId: execution!.id,
      changes: JSON.stringify({ planId, providerId }),
    });

    logger.info({ executionId: execution!.id, planId }, 'Recovery execution created');
    return execution!;
  }

  async getExecution(executionId: string, orgId: string) {
    const [execution] = await db.select().from(recoveryExecutions)
      .where(and(eq(recoveryExecutions.id, executionId), eq(recoveryExecutions.orgId, orgId)));
    if (!execution) throw new Error('Recovery execution not found');
    return execution;
  }

  async startExecution(executionId: string, orgId: string, userId: string) {
    const execution = await this.getExecution(executionId, orgId);
    if (execution.status !== 'pending') {
      throw new Error(`Cannot start execution in status ${execution.status}`);
    }

    const [updated] = await db.update(recoveryExecutions)
      .set({ status: 'in_progress', startedAt: new Date() })
      .where(and(eq(recoveryExecutions.id, executionId), eq(recoveryExecutions.orgId, orgId)))
      .returning();

    await auditLog({
      orgId,
      userId,
      action: 'recovery_execution_started',
      entityType: 'recovery_execution',
      entityId: executionId,
    });

    logger.info({ executionId }, 'Recovery execution started');
    return updated!;
  }

  async completeExecution(executionId: string, orgId: string, userId: string) {
    const execution = await this.getExecution(executionId, orgId);

    const [updated] = await db.update(recoveryExecutions)
      .set({ status: 'completed', completedAt: new Date() })
      .where(and(eq(recoveryExecutions.id, executionId), eq(recoveryExecutions.orgId, orgId)))
      .returning();

    await auditLog({
      orgId,
      userId,
      action: 'recovery_execution_completed',
      entityType: 'recovery_execution',
      entityId: executionId,
    });

    logger.info({ executionId }, 'Recovery execution completed');
    return updated!;
  }

  async failExecution(executionId: string, orgId: string, reason: string, userId: string) {
    const execution = await this.getExecution(executionId, orgId);

    const [updated] = await db.update(recoveryExecutions)
      .set({
        status: 'failed',
        failedAt: new Date(),
        failureReason: reason,
        retryCount: execution.retryCount + 1,
      })
      .where(and(eq(recoveryExecutions.id, executionId), eq(recoveryExecutions.orgId, orgId)))
      .returning();

    await auditLog({
      orgId,
      userId,
      action: 'recovery_execution_failed',
      entityType: 'recovery_execution',
      entityId: executionId,
      changes: JSON.stringify({ reason }),
    });

    logger.warn({ executionId, reason }, 'Recovery execution failed');
    return updated!;
  }

  async cancelExecution(executionId: string, orgId: string, userId: string) {
    const [updated] = await db.update(recoveryExecutions)
      .set({ status: 'cancelled' })
      .where(and(eq(recoveryExecutions.id, executionId), eq(recoveryExecutions.orgId, orgId)))
      .returning();

    await auditLog({
      orgId,
      userId,
      action: 'recovery_execution_cancelled',
      entityType: 'recovery_execution',
      entityId: executionId,
    });

    return updated!;
  }

  async createStep(executionId: string, orgId: string, data: CreateStepInput) {
    const execution = await this.getExecution(executionId, orgId);

    const [step] = await db.insert(recoveryExecutionSteps).values({
      orgId,
      executionId,
      stepOrder: data.stepOrder,
      stepType: data.stepType,
      description: data.description,
      status: 'pending',
      metadata: null,
    }).returning();

    return step!;
  }

  async completeStep(stepId: string, orgId: string) {
    const [updated] = await db.update(recoveryExecutionSteps)
      .set({ status: 'completed', completedAt: new Date() })
      .where(and(eq(recoveryExecutionSteps.id, stepId), eq(recoveryExecutionSteps.orgId, orgId)))
      .returning();
    return updated!;
  }

  async failStep(stepId: string, orgId: string, reason: string) {
    const [updated] = await db.update(recoveryExecutionSteps)
      .set({ status: 'failed', failedAt: new Date(), failureReason: reason })
      .where(and(eq(recoveryExecutionSteps.id, stepId), eq(recoveryExecutionSteps.orgId, orgId)))
      .returning();
    return updated!;
  }

  async getExecutionSteps(executionId: string, orgId: string) {
    return db.select().from(recoveryExecutionSteps)
      .where(and(eq(recoveryExecutionSteps.executionId, executionId), eq(recoveryExecutionSteps.orgId, orgId)))
      .orderBy(asc(recoveryExecutionSteps.stepOrder));
  }

  async canRetry(executionId: string, orgId: string) {
    const execution = await this.getExecution(executionId, orgId);
    return execution.status === 'failed' && execution.retryCount < execution.maxRetries;
  }

  async updateExecutionStatus(executionId: string, orgId: string, status: string, userId: string) {
    const execution = await this.getExecution(executionId, orgId);

    const [updated] = await db
      .update(recoveryExecutions)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(recoveryExecutions.id, executionId), eq(recoveryExecutions.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to update execution status');
    }

    await auditLog({
      orgId,
      userId,
      action: 'recovery_execution.status_update',
      entityType: 'recovery_execution',
      entityId: executionId,
      entityRef: execution.id,
      changes: JSON.stringify({ previousStatus: execution.status, newStatus: status }),
    });

    logger.info({ executionId, previousStatus: execution.status, newStatus: status }, 'Execution status updated');
    return updated;
  }
}

export const recoveryExecutionService = new RecoveryExecutionService();
