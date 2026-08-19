import { Worker, Queue } from 'bullmq';
import { logger } from '../lib/logger';
import { env } from '../lib/env';
import { routingEngine } from '../lib/routing-engine';
import { routeScoring } from '../lib/route-scoring';
import { recoveryService } from '../lib/recovery-service';

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password || undefined,
  };
}

const redisConnection = parseRedisUrl(env.REDIS_URL());

export const recoveryPlanningQueue = new Queue('recovery-planning', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
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

interface RecoveryPlanningJobData {
  planId: string;
  orgId: string;
}

interface RecoveryPlanningResult {
  planId: string;
  optionsGenerated: number;
  optionsScored: number;
  bestOptionId: string | null;
  errors: string[];
}

const recoveryPlanningWorker = new Worker(
  'recovery-planning',
  async (job): Promise<RecoveryPlanningResult> => {
    const { planId, orgId } = job.data as RecoveryPlanningJobData;
    const errors: string[] = [];
    let optionsGenerated = 0;
    let optionsScored = 0;
    let bestOptionId: string | null = null;

    try {
      logger.info({ planId, orgId }, 'Starting recovery planning');

      const plan = await recoveryService.getPlan(planId, orgId);

      const options = await routingEngine.generateRouteOptions(planId, orgId, {
        origin: plan.origin,
        destination: plan.destination,
        currentLocation: plan.currentLocation ?? undefined,
        slaRemainingMinutes: plan.slaRemainingMinutes ?? undefined,
      });

      optionsGenerated = options.length;

      for (const option of options) {
        try {
          const scoring = routeScoring.scoreRoute(
            {
              totalEtaMinutes: option.totalEtaMinutes ?? null,
              riskLevel: option.riskLevel,
              segmentCount: option.segmentCount,
              estimatedCost: option.estimatedCost,
            },
            plan.slaRemainingMinutes ?? null,
          );

          await recoveryService.updateRouteOptionScore(option.id, orgId, scoring.score, scoring.breakdown);
          optionsScored++;

          if (!bestOptionId || scoring.score > 0) {
            bestOptionId = option.id;
          }
        } catch (scoreError) {
          const msg = scoreError instanceof Error ? scoreError.message : 'Unknown scoring error';
          logger.error({ optionId: option.id, error: msg }, 'Failed to score route option');
          errors.push(`Scoring failed for option ${option.id}: ${msg}`);
        }
      }

      logger.info(
        { planId, optionsGenerated, optionsScored, bestOptionId },
        'Recovery planning completed',
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown planning error';
      logger.error({ planId, error: msg }, 'Recovery planning failed');
      errors.push(msg);
    }

    return { planId, optionsGenerated, optionsScored, bestOptionId, errors };
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);

recoveryPlanningWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, result: job.returnvalue }, 'Recovery planning job completed');
});

recoveryPlanningWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error: error.message }, 'Recovery planning job failed');
});

export { recoveryPlanningWorker };
