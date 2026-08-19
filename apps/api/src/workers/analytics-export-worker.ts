import { Worker, Queue } from 'bullmq';
import { logger } from '../lib/logger.js';
import { env } from '../lib/env.js';
import { exportService } from '../lib/export-service.js';

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password || undefined,
  };
}

const redisConnection = parseRedisUrl(env.REDIS_URL());

export const exportQueue = new Queue('analytics-exports', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
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

interface ExportJobData {
  orgId: string;
  exportId: string;
  exportType: string;
  format: string;
  filters: Record<string, unknown>;
}

interface ExportResult {
  exportId: string;
  rowCount: number;
  format: string;
  status: string;
  error?: string;
}

const exportWorker = new Worker(
  'analytics-exports',
  async (job) => {
    const { orgId, exportId, exportType, format, filters } = job.data as ExportJobData;

    logger.info({ jobId: job.id, orgId, exportId, exportType, format }, 'Starting export generation');

    try {
      await exportService.updateExportStatus(orgId, exportId, { status: 'processing' });

      const { data, rowCount } = await exportService.generateExportData(
        orgId,
        exportType,
        filters,
      );

      if (rowCount === 0) {
        await exportService.updateExportStatus(orgId, exportId, {
          status: 'completed',
          rowCount: 0,
        });

        return {
          exportId,
          rowCount: 0,
          format,
          status: 'completed',
        } satisfies ExportResult;
      }

      const formatted = exportService.formatExportData(data, format as 'csv' | 'json');

      await exportService.updateExportStatus(orgId, exportId, {
        status: 'completed',
        rowCount,
      });

      const result: ExportResult = {
        exportId,
        rowCount,
        format,
        status: 'completed',
      };

      logger.info(
        { jobId: job.id, exportId, rowCount, format },
        'Export generation complete',
      );

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ jobId: job.id, exportId, error: message }, 'Export generation failed');

      await exportService
        .updateExportStatus(orgId, exportId, {
          status: 'failed',
        })
        .catch((updateErr) => {
          logger.error(
            { exportId, error: updateErr instanceof Error ? updateErr.message : String(updateErr) },
            'Failed to update export status to failed',
          );
        });

      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
  },
);

exportWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Export job failed');
});

exportWorker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, result }, 'Export job completed');
});

export { exportWorker };
