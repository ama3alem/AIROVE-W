import { Worker, Queue } from 'bullmq';
import { db, baggageEvents, baggage } from '@airove/db';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { env } from '../lib/env';
import { eventService } from '../lib/event-service';
import { baggageStateMachine } from '../lib/state-machine';
import { expectedEventsEngine } from '../lib/expected-events';
import { exceptionService } from '../lib/exception-service';
import type { OperationalEventType } from '@airove/shared';

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password || undefined,
  };
}

const redisConnection = parseRedisUrl(env.REDIS_URL());

export const baggageEventQueue = new Queue('baggage-events', {
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

const baggageEventWorker = new Worker(
  'baggage-events',
  async (job) => {
    const { eventId, orgId } = job.data as { eventId: string; orgId: string };

    const rawEvent = await db.query.baggageEvents.findFirst({
      where: eq(baggageEvents.id, eventId),
    });

    if (!rawEvent) {
      logger.error({ eventId }, 'Event not found');
      return { processed: false, reason: 'not_found' };
    }

    if (rawEvent.status === 'processed' && rawEvent.sequenceNumber) {
      logger.info({ eventId }, 'Event already processed (idempotent)');
      return { processed: true, reason: 'already_processed' };
    }

    const eventType = mapLegacyEventType(rawEvent.eventType);

    const projection = await eventService.getStateProjection(rawEvent.baggageId, orgId);
    const currentState = projection?.currentState ?? 'created';

    const transition = baggageStateMachine.validateTransition(currentState, eventType);

    if (!transition.allowed) {
      logger.warn(
        { eventId, eventType, currentState, reason: transition.reason },
        'Invalid transition — recording exception',
      );

      await exceptionService.generateInvalidTransitionException({
        orgId,
        baggageId: rawEvent.baggageId,
        actualEventId: rawEvent.id,
        currentState,
        eventType,
      });
    }

    await db
      .update(baggageEvents)
      .set({
        eventType,
        status: 'processed',
        processedAt: new Date(),
      })
      .where(eq(baggageEvents.id, eventId));

    if (transition.allowed || transition.reason?.includes('Event type does not cause')) {
      await db
        .update(baggage)
        .set({
          currentState: transition.newState !== currentState ? transition.newState : undefined,
          currentLocation: rawEvent.location ?? undefined,
          lastEventId: rawEvent.id,
          updatedAt: new Date(),
        })
        .where(eq(baggage.id, rawEvent.baggageId));
    }

    const matchingExpected = await expectedEventsEngine.findMatchingExpectedEvent({
      baggageId: rawEvent.baggageId,
      eventType,
      orgId,
    });

    if (matchingExpected) {
      await expectedEventsEngine.fulfillExpectedEvent({
        expectedEventId: matchingExpected.id,
        actualEventId: rawEvent.id,
      });
    }

    logger.info({ eventId, eventType, newState: transition.newState }, 'Event processed');

    return { processed: true, stateTransition: transition };
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);

baggageEventWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Baggage event job failed');
});

baggageEventWorker.on('completed', (job, result) => {
  logger.info({ jobId: job.id, result }, 'Baggage event job completed');
});

function mapLegacyEventType(eventType: string): OperationalEventType {
  const map: Record<string, OperationalEventType> = {
    bag_accepted: 'baggage_accepted',
    bag_screened: 'baggage_screened',
    bag_loaded: 'baggage_loaded',
    bag_unloaded: 'baggage_unloaded',
    bag_transferred: 'baggage_transferred',
    bag_delivered: 'baggage_delivered',
    bag_missing: 'baggage_mishandled',
    bag_delayed: 'baggage_mishandled',
    bag_damaged: 'baggage_mishandled',
    bag_misrouted: 'baggage_mishandled',
    bag_recovered: 'baggage_found',
  };
  return map[eventType] ?? (eventType as OperationalEventType);
}
