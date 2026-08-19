import { Worker, Queue } from 'bullmq';
import { logger } from '../lib/logger';
import { env } from '../lib/env';
import { alertEngineService } from '../lib/alert-engine';

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password || undefined,
  };
}

const redisConnection = parseRedisUrl(env.REDIS_URL());

export const alertEvaluationQueue = new Queue('alert-evaluation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400,
      count: 500,
    },
    removeOnFail: {
      age: 604800,
      count: 1000,
    },
  },
});

interface AlertEvaluationJobData {
  orgId: string;
}

interface AlertEvaluationResult {
  rulesEvaluated: number;
  alertsTriggered: number;
  errors: string[];
}

const alertEvaluationWorker = new Worker(
  'alert-evaluation',
  async (job) => {
    const { orgId } = job.data as AlertEvaluationJobData;

    logger.info({ jobId: job.id, orgId }, 'Starting alert evaluation');

    const result: AlertEvaluationResult = {
      rulesEvaluated: 0,
      alertsTriggered: 0,
      errors: [],
    };

    try {
      const rules = await alertEngineService.listAlertRules(orgId);
      result.rulesEvaluated = rules.length;

      const alerts = await alertEngineService.evaluateRules(orgId);
      result.alertsTriggered = alerts.length;

      logger.info(
        {
          jobId: job.id,
          orgId,
          rulesEvaluated: result.rulesEvaluated,
          alertsTriggered: result.alertsTriggered,
        },
        'Alert evaluation complete',
      );

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ jobId: job.id, orgId, error: message }, 'Alert evaluation failed');
      result.errors.push(`fatal:${message}`);
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
  },
);

alertEvaluationWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Alert evaluation job failed');
});

alertEvaluationWorker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, result }, 'Alert evaluation job completed');
});

export { alertEvaluationWorker };
