import { Worker, Queue } from 'bullmq';
import { db, operationalExceptions } from '@airove/db';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { env } from '../lib/env';
import { workflowEngine } from '../lib/workflow-engine';
import { exceptionService, registerPipelineTrigger } from '../lib/exception-service';

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password || undefined,
  };
}

const redisConnection = parseRedisUrl(env.REDIS_URL());

export const exceptionPipelineQueue = new Queue('exception-pipeline', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 86400,
      count: 1000,
    },
    removeOnFail: {
      age: 604800,
      count: 5000,
    },
  },
});

interface ExceptionPipelineJobData {
  exceptionId: string;
  orgId: string;
}

const exceptionPipelineWorker = new Worker(
  'exception-pipeline',
  async (job) => {
    const { exceptionId, orgId } = job.data as ExceptionPipelineJobData;

    const exception = await db.query.operationalExceptions.findFirst({
      where: eq(operationalExceptions.id, exceptionId),
    });

    if (!exception) {
      logger.error({ exceptionId }, 'Exception not found for pipeline processing');
      return { processed: false, reason: 'not_found' };
    }

    try {
      const createdCase = await workflowEngine.processExceptionToCase(
        {
          exceptionType: exception.exceptionType,
          severity: exception.severity,
          baggageId: exception.baggageId ?? undefined,
          flightId: exception.flightId ?? undefined,
          journeyId: exception.journeyId ?? undefined,
          description: exception.description,
          metadata: exception.metadata ? (JSON.parse(exception.metadata) as Record<string, unknown>) : undefined,
          orgId,
        },
        orgId,
      );

      if (createdCase) {
        await exceptionService.linkToCase(exceptionId, createdCase.id, orgId);
      }

      logger.info(
        {
          exceptionId,
          orgId,
          caseId: createdCase?.id,
          caseNumber: createdCase?.caseNumber,
        },
        'Exception pipeline completed',
      );

      return {
        processed: true,
        caseId: createdCase?.id,
        caseNumber: createdCase?.caseNumber,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(
        { exceptionId, orgId, error: errorMsg },
        'Exception pipeline failed',
      );
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
  },
);

exceptionPipelineWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Exception pipeline job failed');
});

exceptionPipelineWorker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, result }, 'Exception pipeline job completed');
});

export async function triggerExceptionPipeline(exceptionId: string, orgId: string) {
  await exceptionPipelineQueue.add(
    'process-exception',
    { exceptionId, orgId },
    {
      jobId: `exception_pipeline_${exceptionId}`,
    },
  );

  logger.info({ exceptionId, orgId }, 'Exception pipeline triggered');
}

registerPipelineTrigger(triggerExceptionPipeline);
