import { Worker, Queue } from 'bullmq';
import { logger } from '../lib/logger';
import { env } from '../lib/env';
import { slaService } from '../lib/sla-engine';
import { escalationService } from '../lib/escalation-engine';
import { caseActivityService } from '../lib/case-activity-service';

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password || undefined,
  };
}

const redisConnection = parseRedisUrl(env.REDIS_URL());

export const slaEscalationQueue = new Queue('sla-escalation', {
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

interface SLACheckJobData {
  orgId: string;
}

interface SLACheckResult {
  warningsChecked: number;
  breachesChecked: number;
  warningsLogged: number;
  breachesEscalated: number;
  errors: string[];
}

const slaEscalationWorker = new Worker(
  'sla-escalation',
  async (job) => {
    const { orgId } = job.data as SLACheckJobData;

    logger.info({ jobId: job.id, orgId }, 'Starting SLA escalation check');

    const result: SLACheckResult = {
      warningsChecked: 0,
      breachesChecked: 0,
      warningsLogged: 0,
      breachesEscalated: 0,
      errors: [],
    };

    try {
      const warningSLAs = await slaService.checkAllWarningSLAs(orgId);
      result.warningsChecked = warningSLAs.length;

      for (const sla of warningSLAs) {
        try {
          const updated = await slaService.checkSLAWarning(sla.caseId, orgId);
          if (updated && updated.warningTriggeredAt && !sla.warningTriggeredAt) {
            await caseActivityService.logSLAWarning(sla.caseId, orgId);
            result.warningsLogged++;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error({ caseId: sla.caseId, slaId: sla.id, error: message }, 'Failed to check SLA warning');
          result.errors.push(`warning_check:${sla.caseId}:${message}`);
        }
      }

      const breachedSLAs = await slaService.checkAllBreachedSLAs(orgId);
      result.breachesChecked = breachedSLAs.length;

      for (const sla of breachedSLAs) {
        try {
          await slaService.checkSLABreach(sla.caseId, orgId);

          const escalated = await escalationService.autoEscalate(orgId);
          result.breachesEscalated += escalated.length;

          if (escalated.length > 0) {
            await caseActivityService.logSLABreached(sla.caseId, orgId);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error({ caseId: sla.caseId, slaId: sla.id, error: message }, 'Failed to process SLA breach');
          result.errors.push(`breach_check:${sla.caseId}:${message}`);
        }
      }

      logger.info(
        {
          jobId: job.id,
          orgId,
          warningsChecked: result.warningsChecked,
          breachesChecked: result.breachesChecked,
          warningsLogged: result.warningsLogged,
          breachesEscalated: result.breachesEscalated,
          errorCount: result.errors.length,
        },
        'SLA escalation check complete',
      );

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ jobId: job.id, orgId, error: message }, 'SLA escalation check failed');
      result.errors.push(`fatal:${message}`);
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  },
);

slaEscalationWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'SLA escalation job failed');
});

slaEscalationWorker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, result }, 'SLA escalation job completed');
});

export { slaEscalationWorker };
