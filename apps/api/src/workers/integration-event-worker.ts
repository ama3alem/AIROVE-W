import { Worker, Queue } from 'bullmq';
import { db, integrationEvents, integrations } from '@airove/db';
import { eq, and } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { env } from '../lib/env';
import { normalizationEngine, type RawInboundEvent } from '../lib/normalization';
import { integrationService } from '../lib/integration-service';
import { eventService } from '../lib/event-service';
import { expectedEventsEngine } from '../lib/expected-events';
import type { IntegrationMapping } from '@airove/shared';

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password || undefined,
  };
}

const redisConnection = parseRedisUrl(env.REDIS_URL());

export const integrationEventQueue = new Queue('integration-events', {
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

interface IntegrationEventJobData {
  eventId: string;
  integrationId: string;
  orgId: string;
}

const integrationEventWorker = new Worker(
  'integration-events',
  async (job) => {
    const { eventId, integrationId, orgId } = job.data as IntegrationEventJobData;

    const event = await db.query.integrationEvents.findFirst({
      where: eq(integrationEvents.id, eventId),
    });

    if (!event) {
      logger.error({ eventId }, 'Integration event not found');
      return { processed: false, reason: 'not_found' };
    }

    if (event.status === 'processed') {
      logger.info({ eventId }, 'Event already processed (idempotent)');
      return { processed: true, reason: 'already_processed' };
    }

    if (event.status === 'duplicate_ignored') {
      return { processed: true, reason: 'duplicate' };
    }

    const integration = await db.query.integrations.findFirst({
      where: eq(integrations.id, integrationId),
    });

    if (!integration) {
      logger.error({ integrationId }, 'Integration not found');
      return { processed: false, reason: 'integration_not_found' };
    }

    const mapping = integration.mappingConfig as IntegrationMapping | null;

    const rawPayload = event.rawPayload ? JSON.parse(event.rawPayload) : {};

    const raw: RawInboundEvent = {
      integrationId,
      orgId,
      integrationName: integration.name,
      provider: integration.provider ?? undefined,
      externalEventId: event.externalEventId,
      eventType: event.eventType,
      timestamp: event.receivedAt.toISOString(),
      payload: rawPayload,
      correlationId: event.correlationId ?? undefined,
    };

    try {
      await integrationService.updateEventStatus(eventId, 'normalizing');

      const normalized = normalizationEngine.normalize(raw, mapping ?? undefined);

      const baggageTag = normalizationEngine.resolveEntityId(rawPayload, 'baggage');
      if (baggageTag) {
        const existingBaggage = await integrationService.resolveEntity(
          integrationId,
          'baggage',
          baggageTag,
        );

        if (!existingBaggage) {
          logger.info(
            { eventId, externalEntityId: baggageTag },
            'Unknown baggage entity — pending resolution',
          );

          await integrationService.updateEventStatus(eventId, 'pending_resolution', {
            normalizedPayload: JSON.stringify(normalized),
          });

          return { processed: false, reason: 'unknown_entity', entity: baggageTag };
        }

        normalized.baggageId = existingBaggage;
      }

      await integrationService.updateEventStatus(eventId, 'processed', {
        normalizedPayload: JSON.stringify(normalized),
        processedAt: new Date(),
      });

      await integrationService.resetConsecutiveFailures(integrationId);

      logger.info(
        { eventId, eventType: normalized.eventType, externalEventId: raw.externalEventId },
        'Event normalized and processed',
      );

      if (normalized.baggageId) {
        try {
          const opResult = await eventService.createEvent({
            orgId: raw.orgId,
            baggageId: normalized.baggageId,
            flightId: normalized.flightId,
            eventType: normalized.eventType as 'baggage_accepted',
            eventSource: 'external_integration',
            actorType: 'integration',
            actorId: integrationId,
            location: normalized.location,
            airportCode: normalized.airportCode,
            terminal: normalized.terminal,
            handler: normalized.handler,
            idempotencyKey: raw.externalEventId,
            rawPayload: JSON.stringify(rawPayload),
            metadata: {
              integrationId,
              provider: raw.provider,
              correlationId: raw.correlationId,
            },
            occurredAt: new Date(raw.timestamp),
          });

          if (opResult.isNew) {
            const matchingExpected = await expectedEventsEngine.findMatchingExpectedEvent({
              baggageId: normalized.baggageId,
              eventType: normalized.eventType,
              orgId: raw.orgId,
            });

            if (matchingExpected) {
              await expectedEventsEngine.fulfillExpectedEvent({
                expectedEventId: matchingExpected.id,
                actualEventId: opResult.event.id,
              });
            }
          }
        } catch (err) {
          logger.error(
            { eventId, baggageId: normalized.baggageId, error: err instanceof Error ? err.message : String(err) },
            'Failed to create operational event from normalized event',
          );
        }
      }

      return { processed: true, normalizedEvent: normalized };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      logger.error({ eventId, error: errorMsg }, 'Event processing failed');

      await integrationService.recordEventFailed(integrationId, orgId, errorMsg);

      const currentEvent = await db.query.integrationEvents.findFirst({
        where: eq(integrationEvents.id, eventId),
      });

      const retryCount = (currentEvent?.retryCount ?? 0) + 1;
      const maxRetries = currentEvent?.maxRetries ?? 3;

      if (retryCount >= maxRetries) {
        await integrationService.updateEventStatus(eventId, 'quarantined', {
          failureReason: errorMsg,
          retryCount,
        });

        logger.warn(
          { eventId, retryCount, maxRetries },
          'Event quarantined after max retries',
        );

        return { processed: false, reason: 'quarantined', error: errorMsg };
      }

      await integrationService.updateEventStatus(eventId, 'failed', {
        failureReason: errorMsg,
        retryCount,
      });

      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);

integrationEventWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Integration event job failed');
});

integrationEventWorker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, result }, 'Integration event job completed');
});

export async function replayEvent(eventId: string, orgId: string) {
  const event = await db.query.integrationEvents.findFirst({
    where: and(
      eq(integrationEvents.id, eventId),
      eq(integrationEvents.orgId, orgId),
    ),
  });

  if (!event) {
    throw new Error('Event not found');
  }

  if (event.status !== 'quarantined' && event.status !== 'failed') {
    throw new Error(`Cannot replay event in status: ${event.status}`);
  }

  await integrationService.updateEventStatus(eventId, 'received', {
    retryCount: 0,
    failureReason: null,
  });

  await integrationEventQueue.add(
    'process-integration-event',
    {
      eventId: event.id,
      integrationId: event.integrationId,
      orgId: event.orgId,
    },
    {
      jobId: `replay_${event.id}`,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  );

  logger.info({ eventId }, 'Event queued for replay');
}
