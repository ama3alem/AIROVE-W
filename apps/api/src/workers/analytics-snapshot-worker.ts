import { Worker, Queue } from 'bullmq';
import { logger } from '../lib/logger';
import { env } from '../lib/env';
import { metricEngineService } from '../lib/metric-engine';
import { aggregationService } from '../lib/aggregation-service';
import type { AnalyticsGranularity, AnalyticsTimeRange } from '@airove/shared';

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password || undefined,
  };
}

const redisConnection = parseRedisUrl(env.REDIS_URL());

export const analyticsSnapshotQueue = new Queue('analytics-snapshots', {
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

interface SnapshotJobData {
  orgId: string;
  timeRange?: AnalyticsTimeRange;
  granularity?: AnalyticsGranularity;
}

interface SnapshotResult {
  snapshotsCreated: number;
  metricsProcessed: string[];
  errors: string[];
}

const METRIC_SNAPSHOTS: Array<{
  metricName: string;
  aggregator: (
    orgId: string,
    timeRange: AnalyticsTimeRange,
    customFrom?: string,
    customTo?: string,
  ) => Promise<number>;
}> = [
  {
    metricName: 'baggage_total',
    aggregator: async (orgId, timeRange, customFrom, customTo) => {
      const results = await aggregationService.aggregateBaggageMetrics(
        orgId,
        timeRange,
        undefined,
        customFrom,
        customTo,
      );
      return results.reduce((sum, r) => sum + (r.count ?? r.value), 0);
    },
  },
  {
    metricName: 'cases_total',
    aggregator: async (orgId, timeRange, customFrom, customTo) => {
      const results = await aggregationService.aggregateCaseMetrics(
        orgId,
        timeRange,
        undefined,
        customFrom,
        customTo,
      );
      return results.reduce((sum, r) => sum + (r.count ?? r.value), 0);
    },
  },
  {
    metricName: 'recovery_total',
    aggregator: async (orgId, timeRange, customFrom, customTo) => {
      const results = await aggregationService.aggregateRecoveryMetrics(
        orgId,
        timeRange,
        undefined,
        customFrom,
        customTo,
      );
      return results.reduce((sum, r) => sum + (r.count ?? r.value), 0);
    },
  },
  {
    metricName: 'sla_active',
    aggregator: async (orgId, timeRange, customFrom, customTo) => {
      const results = await aggregationService.aggregateSLAMetrics(
        orgId,
        timeRange,
        customFrom,
        customTo,
      );
      return results
        .filter((r) => r.metric.includes('active'))
        .reduce((sum, r) => sum + (r.count ?? r.value), 0);
    },
  },
  {
    metricName: 'events_total',
    aggregator: async (orgId, timeRange, customFrom, customTo) => {
      const results = await aggregationService.aggregateEventMetrics(
        orgId,
        timeRange,
        customFrom,
        customTo,
      );
      return results.reduce((sum, r) => sum + (r.count ?? r.value), 0);
    },
  },
];

const analyticsSnapshotWorker = new Worker(
  'analytics-snapshots',
  async (job) => {
    const { orgId, timeRange = 'today', granularity = 'day' } =
      job.data as SnapshotJobData;

    logger.info({ jobId: job.id, orgId, timeRange, granularity }, 'Starting snapshot generation');

    const result: SnapshotResult = {
      snapshotsCreated: 0,
      metricsProcessed: [],
      errors: [],
    };

    const now = new Date();
    const periodFrom = new Date(now);
    periodFrom.setHours(0, 0, 0, 0);
    if (granularity === 'week') {
      periodFrom.setDate(periodFrom.getDate() - periodFrom.getDay());
    } else if (granularity === 'month') {
      periodFrom.setDate(1);
    }
    const periodTo = now;

    for (const metric of METRIC_SNAPSHOTS) {
      try {
        const value = await metric.aggregator(orgId, timeRange);

        await metricEngineService.upsertSnapshot(orgId, {
          metricName: metric.metricName,
          dimensions: {},
          value,
          periodFrom,
          periodTo,
          granularity,
        });

        result.snapshotsCreated++;
        result.metricsProcessed.push(metric.metricName);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(
          { jobId: job.id, orgId, metricName: metric.metricName, error: message },
          'Failed to generate snapshot for metric',
        );
        result.errors.push(`${metric.metricName}:${message}`);
      }
    }

    logger.info(
      {
        jobId: job.id,
        orgId,
        snapshotsCreated: result.snapshotsCreated,
        errorCount: result.errors.length,
      },
      'Snapshot generation complete',
    );

    return result;
  },
  {
    connection: redisConnection,
    concurrency: 2,
  },
);

analyticsSnapshotWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Analytics snapshot job failed');
});

analyticsSnapshotWorker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, result }, 'Analytics snapshot job completed');
});

export { analyticsSnapshotWorker };
