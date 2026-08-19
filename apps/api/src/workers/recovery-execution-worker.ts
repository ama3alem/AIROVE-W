import { Worker, Queue } from 'bullmq';
import { logger } from '../lib/logger';
import { env } from '../lib/env';
import { recoveryExecutionService } from '../lib/recovery-execution';
import { auditLog } from '../lib/audit-logger';

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password || undefined,
  };
}

const redisConnection = parseRedisUrl(env.REDIS_URL());

export const recoveryExecutionQueue = new Queue('recovery-execution', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: {
      age: 86400,
      count: 200,
    },
    removeOnFail: {
      age: 604800,
      count: 500,
    },
  },
});

interface RecoveryExecutionJobData {
  executionId: string;
  orgId: string;
  userId: string;
}

interface RecoveryExecutionResult {
  executionId: string;
  stepsCompleted: number;
  stepsFailed: number;
  finalStatus: string;
  errors: string[];
}

const recoveryExecutionWorker = new Worker(
  'recovery-execution',
  async (job): Promise<RecoveryExecutionResult> => {
    const { executionId, orgId, userId } = job.data as RecoveryExecutionJobData;
    const errors: string[] = [];
    let stepsCompleted = 0;
    let stepsFailed = 0;

    try {
      logger.info({ executionId, orgId }, 'Starting recovery execution');

      const execution = await recoveryExecutionService.getExecution(executionId, orgId);

      if (execution.status !== 'in_progress') {
        throw new Error(`Execution ${executionId} is not in progress (status: ${execution.status})`);
      }

      const steps = await recoveryExecutionService.getExecutionSteps(executionId, orgId);

      for (const step of steps) {
        if (step.status === 'completed' || step.status === 'skipped') {
          stepsCompleted++;
          continue;
        }

        try {
          await recoveryExecutionService.completeStep(step.id, orgId);
          stepsCompleted++;
          logger.info({ stepId: step.id, stepOrder: step.stepOrder }, 'Execution step completed');
        } catch (stepError) {
          const msg = stepError instanceof Error ? stepError.message : 'Unknown step error';

          try {
            await recoveryExecutionService.failStep(step.id, orgId, msg);
          } catch (failError) {
            logger.error({ stepId: step.id, error: failError }, 'Failed to record step failure');
          }

          stepsFailed++;
          errors.push(`Step ${step.stepOrder} failed: ${msg}`);
          logger.error({ stepId: step.id, error: msg }, 'Execution step failed');
        }
      }

      let finalStatus = 'completed';
      if (stepsFailed > 0 && stepsCompleted > 0) {
        finalStatus = 'completed_with_errors';
      } else if (stepsFailed > 0 && stepsCompleted === 0) {
        finalStatus = 'failed';
      }

      if (finalStatus !== 'completed') {
        await recoveryExecutionService.updateExecutionStatus(
          executionId,
          orgId,
          finalStatus,
          userId,
        );
      }

      await auditLog({
        orgId,
        userId,
        action: 'recovery_execution.progress',
        entityType: 'recovery_execution',
        entityId: executionId,
        changes: JSON.stringify({ stepsCompleted, stepsFailed, finalStatus }),
      });

      logger.info(
        { executionId, stepsCompleted, stepsFailed, finalStatus },
        'Recovery execution completed',
      );

      return { executionId, stepsCompleted, stepsFailed, finalStatus, errors };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown execution error';
      logger.error({ executionId, error: msg }, 'Recovery execution failed');
      errors.push(msg);

      return { executionId, stepsCompleted, stepsFailed, finalStatus: 'failed', errors };
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
  },
);

recoveryExecutionWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, result: job.returnvalue }, 'Recovery execution job completed');
});

recoveryExecutionWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error: error.message }, 'Recovery execution job failed');
});

export { recoveryExecutionWorker };
