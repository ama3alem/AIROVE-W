import {
  db,
  baggageEvents,
  baggage,
  baggageStateProjections,
  eventOutbox,
} from '@airove/db';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { logger } from './logger';
import { baggageStateMachine } from './state-machine';
import { auditLog } from './audit-logger';
import type { BaggageLifecycleState, OperationalEventType, EventSource, ActorType, BaggageTimelineEntry, EventIntegrityHash, ReplayResult } from '@airove/shared';

export interface CreateOperationalEventInput {
  orgId: string;
  baggageId: string;
  flightId?: string;
  eventType: OperationalEventType;
  eventSource: EventSource;
  actorType?: ActorType;
  actorId?: string;
  location?: string;
  airportCode?: string;
  terminal?: string;
  handler?: string;
  idempotencyKey?: string;
  rawPayload?: string;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
}

export class EventService {
  async createEvent(input: CreateOperationalEventInput) {
    if (input.idempotencyKey) {
      const existing = await db.query.baggageEvents.findFirst({
        where: and(
          eq(baggageEvents.orgId, input.orgId),
          eq(baggageEvents.idempotencyKey, input.idempotencyKey),
        ),
      });

      if (existing) {
        logger.info({ idempotencyKey: input.idempotencyKey }, 'Duplicate event (idempotent)');
        return { event: existing, isNew: false };
      }
    }

    const projection = await this.getStateProjection(input.baggageId, input.orgId);
    const currentState = projection?.currentState ?? 'created';

    const transition = baggageStateMachine.validateTransition(currentState, input.eventType);

    if (!transition.allowed && transition.reason) {
      logger.warn(
        { baggageId: input.baggageId, eventType: input.eventType, currentState, reason: transition.reason },
        'Invalid state transition recorded',
      );
    }

    const seq = (projection?.sequenceNumber ?? 0) + 1;
    const prevHash = projection?.lastEventHash ?? null;

    const eventHash = this.computeHash({
      orgId: input.orgId,
      baggageId: input.baggageId,
      eventType: input.eventType,
      eventSource: input.eventSource,
      occurredAt: input.occurredAt.toISOString(),
      sequenceNumber: seq,
      previousEventHash: prevHash,
    });

    const result = await db.insert(baggageEvents).values({
      orgId: input.orgId,
      baggageId: input.baggageId,
      flightId: input.flightId ?? null,
      eventType: input.eventType,
      eventSource: input.eventSource,
      actorType: input.actorType ?? null,
      actorId: input.actorId ?? null,
      location: input.location ?? null,
      airportCode: input.airportCode ?? null,
      terminal: input.terminal ?? null,
      handler: input.handler ?? null,
      status: 'processed',
      sequenceNumber: seq,
      correctionOf: null,
      eventHash,
      previousEventHash: prevHash,
      schemaVersion: '1.0',
      idempotencyKey: input.idempotencyKey ?? null,
      rawPayload: input.rawPayload ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      occurredAt: input.occurredAt,
      processedAt: new Date(),
    }).returning();

    const event = result[0];
    if (!event) {
      throw new Error('Failed to create operational event');
    }

    const newState = transition.newState;

    if (newState !== currentState) {
      await this.upsertStateProjection({
        orgId: input.orgId,
        baggageId: input.baggageId,
        currentState: newState,
        currentLocation: input.location ?? null,
        currentAirportCode: input.airportCode ?? null,
        lastEventId: event.id,
        lastEventType: input.eventType,
        lastEventAt: input.occurredAt,
        sequenceNumber: seq,
        lastEventHash: eventHash,
      });
    } else {
      await db
        .update(baggageStateProjections)
        .set({
          lastEventId: event.id,
          lastEventType: input.eventType,
          lastEventAt: input.occurredAt,
          sequenceNumber: seq,
          lastEventHash: eventHash,
          eventCount: sql`${baggageStateProjections.eventCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(baggageStateProjections.baggageId, input.baggageId));
    }

    await db
      .update(baggage)
      .set({
        currentState: newState !== currentState ? newState : undefined,
        currentLocation: input.location ?? undefined,
        lastEventId: event.id,
        updatedAt: new Date(),
      })
      .where(eq(baggage.id, input.baggageId));

    await this.enqueueOutbox({
      orgId: input.orgId,
      eventType: input.eventType,
      aggregateType: 'baggage',
      aggregateId: input.baggageId,
      payload: JSON.stringify(event),
    });

    return { event, isNew: true, stateTransition: transition };
  }

  async correctEvent(params: {
    eventId: string;
    orgId: string;
    correctedEventType: OperationalEventType;
    reason: string;
    correctedBy: string;
    metadata?: Record<string, unknown>;
  }) {
    const originalEvent = await db.query.baggageEvents.findFirst({
      where: and(
        eq(baggageEvents.id, params.eventId),
        eq(baggageEvents.orgId, params.orgId),
      ),
    });

    if (!originalEvent) {
      throw new Error('Original event not found');
    }

    if (originalEvent.correctionOf) {
      throw new Error('Cannot correct an event that is itself a correction');
    }

    const correctionEvent = await this.createEvent({
      orgId: params.orgId,
      baggageId: originalEvent.baggageId,
      flightId: originalEvent.flightId ?? undefined,
      eventType: 'event_corrected' as OperationalEventType,
      eventSource: 'correction',
      actorType: 'user',
      actorId: params.correctedBy,
      location: originalEvent.location ?? undefined,
      airportCode: originalEvent.airportCode ?? undefined,
      terminal: originalEvent.terminal ?? undefined,
      handler: originalEvent.handler ?? undefined,
      metadata: {
        correctionOf: params.eventId,
        originalEventType: originalEvent.eventType,
        correctedEventType: params.correctedEventType,
        reason: params.reason,
        ...params.metadata,
      },
      occurredAt: new Date(),
    });

    await db
      .update(baggageEvents)
      .set({
        metadata: JSON.stringify({
          ...JSON.parse(originalEvent.metadata ?? '{}'),
          correctedBy: params.correctedBy,
          correctedAt: new Date().toISOString(),
          correctedEventType: params.correctedEventType,
        }),
      })
      .where(eq(baggageEvents.id, params.eventId));

    await auditLog({
      orgId: params.orgId,
      userId: params.correctedBy,
      action: 'baggage:event.correct',
      entityType: 'baggage_event',
      entityId: params.eventId,
      entityRef: originalEvent.eventType,
      changes: JSON.stringify({
        originalType: originalEvent.eventType,
        correctedType: params.correctedEventType,
        reason: params.reason,
      }),
    });

    return correctionEvent;
  }

  async getTimeline(baggageId: string, orgId: string): Promise<BaggageTimelineEntry[]> {
    const events = await db.query.baggageEvents.findMany({
      where: eq(baggageEvents.baggageId, baggageId),
      orderBy: [asc(baggageEvents.sequenceNumber), asc(baggageEvents.occurredAt)],
    });

    return events.map((e) => ({
      eventId: e.id,
      eventType: e.eventType as BaggageTimelineEntry['eventType'],
      eventSource: (e.eventSource ?? 'system') as BaggageTimelineEntry['eventSource'],
      occurredAt: e.occurredAt,
      recordedAt: e.createdAt,
      location: e.location,
      airportCode: e.airportCode,
      terminal: e.terminal,
      handler: e.handler,
      actorType: (e.actorType ?? null) as BaggageTimelineEntry['actorType'],
      actorId: e.actorId,
      status: e.status,
      isCorrection: e.eventType === 'event_corrected',
      correctionOf: e.correctionOf,
      metadata: e.metadata ? JSON.parse(e.metadata) : null,
    }));
  }

  async getStateProjection(baggageId: string, orgId: string) {
    return db.query.baggageStateProjections.findFirst({
      where: and(
        eq(baggageStateProjections.baggageId, baggageId),
        eq(baggageStateProjections.orgId, orgId),
      ),
    });
  }

  async upsertStateProjection(params: {
    orgId: string;
    baggageId: string;
    currentState: BaggageLifecycleState;
    currentLocation?: string | null;
    currentAirportCode?: string | null;
    currentCustodian?: string | null;
    currentCustodianType?: string | null;
    lastEventId?: string | null;
    lastEventType?: string | null;
    lastEventAt?: Date | null;
    expectedNextEvent?: string | null;
    expectedNextEventAt?: Date | null;
    sequenceNumber?: number;
    lastEventHash?: string | null;
  }) {
    const existing = await this.getStateProjection(params.baggageId, params.orgId);

    if (existing) {
      await db
        .update(baggageStateProjections)
        .set({
          currentState: params.currentState,
          currentLocation: params.currentLocation ?? existing.currentLocation,
          currentAirportCode: params.currentAirportCode ?? existing.currentAirportCode,
          currentCustodian: params.currentCustodian ?? existing.currentCustodian,
          currentCustodianType: params.currentCustodianType ?? existing.currentCustodianType,
          lastEventId: params.lastEventId ?? existing.lastEventId,
          lastEventType: params.lastEventType ?? existing.lastEventType,
          lastEventAt: params.lastEventAt ?? existing.lastEventAt,
          expectedNextEvent: params.expectedNextEvent ?? existing.expectedNextEvent,
          expectedNextEventAt: params.expectedNextEventAt ?? existing.expectedNextEventAt,
          sequenceNumber: params.sequenceNumber ?? existing.sequenceNumber,
          lastEventHash: params.lastEventHash ?? existing.lastEventHash,
          eventCount: existing.eventCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(baggageStateProjections.baggageId, params.baggageId));
    } else {
      await db.insert(baggageStateProjections).values({
        orgId: params.orgId,
        baggageId: params.baggageId,
        currentState: params.currentState,
        currentLocation: params.currentLocation ?? null,
        currentAirportCode: params.currentAirportCode ?? null,
        currentCustodian: params.currentCustodian ?? null,
        currentCustodianType: params.currentCustodianType ?? null,
        lastEventId: params.lastEventId ?? null,
        lastEventType: params.lastEventType ?? null,
        lastEventAt: params.lastEventAt ?? null,
        expectedNextEvent: params.expectedNextEvent ?? null,
        expectedNextEventAt: params.expectedNextEventAt ?? null,
        sequenceNumber: params.sequenceNumber ?? 1,
        lastEventHash: params.lastEventHash ?? null,
        eventCount: 1,
      });
    }
  }

  async replayBaggage(baggageId: string, orgId: string): Promise<ReplayResult> {
    const events = await db.query.baggageEvents.findMany({
      where: and(
        eq(baggageEvents.baggageId, baggageId),
        eq(baggageEvents.orgId, orgId),
      ),
      orderBy: [asc(baggageEvents.occurredAt), asc(baggageEvents.createdAt)],
    });

    const initialProjection = await this.getStateProjection(baggageId, orgId);

    const initialState = initialProjection ?? {
      id: '',
      orgId,
      baggageId,
      currentState: 'created' as BaggageLifecycleState,
      currentLocation: null,
      currentAirportCode: null,
      currentCustodian: null,
      currentCustodianType: null,
      lastEventId: null,
      lastEventType: null,
      lastEventAt: null,
      expectedNextEvent: null,
      expectedNextEventAt: null,
      sequenceNumber: 0,
      lastEventHash: null,
      eventCount: 0,
      updatedAt: new Date(),
    };

    await db
      .delete(baggageStateProjections)
      .where(eq(baggageStateProjections.baggageId, baggageId));

    let currentState: BaggageLifecycleState = 'created';
    let lastHash: string | null = null;
    let seq = 0;

    for (const event of events) {
      seq++;
      const eventType = event.eventType as OperationalEventType;

      const transition = baggageStateMachine.validateTransition(currentState, eventType);
      const newState = transition.newState;

      const eventHash = this.computeHash({
        orgId,
        baggageId,
        eventType,
        eventSource: event.eventSource ?? 'system',
        occurredAt: event.occurredAt.toISOString(),
        sequenceNumber: seq,
        previousEventHash: lastHash,
      });

      await this.upsertStateProjection({
        orgId,
        baggageId,
        currentState: newState !== currentState ? newState : currentState,
        currentLocation: event.location,
        currentAirportCode: event.airportCode,
        lastEventId: event.id,
        lastEventType: eventType,
        lastEventAt: event.occurredAt,
        sequenceNumber: seq,
        lastEventHash: eventHash,
      });

      if (newState !== currentState) {
        currentState = newState;
      }
      lastHash = eventHash;
    }

    const finalProjection = await this.getStateProjection(baggageId, orgId);

    await db
      .update(baggage)
      .set({
        currentState: finalProjection?.currentState ?? 'created',
        currentLocation: finalProjection?.currentLocation,
        lastEventId: finalProjection?.lastEventId,
        updatedAt: new Date(),
      })
      .where(eq(baggage.id, baggageId));

    logger.info({ baggageId, eventsReplayed: seq }, 'Baggage state replayed from event ledger');

    return {
      baggageId,
      initialState: initialState as ReplayResult['initialState'],
      finalState: (finalProjection ?? initialState) as ReplayResult['finalState'],
      eventsReplayed: seq,
      exceptions: [],
    };
  }

  async listEvents(baggageId: string, orgId: string, page = 1, pageSize = 50) {
    return db.query.baggageEvents.findMany({
      where: and(
        eq(baggageEvents.baggageId, baggageId),
        eq(baggageEvents.orgId, orgId),
      ),
      orderBy: [desc(baggageEvents.occurredAt)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  }

  async getEventById(eventId: string, orgId: string) {
    return db.query.baggageEvents.findFirst({
      where: and(
        eq(baggageEvents.id, eventId),
        eq(baggageEvents.orgId, orgId),
      ),
    });
  }

  async getEventIntegrity(eventId: string): Promise<EventIntegrityHash | null> {
    const event = await db.query.baggageEvents.findFirst({
      where: eq(baggageEvents.id, eventId),
    });

    if (!event) return null;

    return {
      eventHash: event.eventHash ?? '',
      previousEventHash: event.previousEventHash,
    };
  }

  private async enqueueOutbox(params: {
    orgId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: string;
  }) {
    await db.insert(eventOutbox).values({
      orgId: params.orgId,
      eventType: params.eventType,
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      payload: params.payload,
      status: 'pending',
    });
  }

  private computeHash(params: {
    orgId: string;
    baggageId: string;
    eventType: string;
    eventSource: string;
    occurredAt: string;
    sequenceNumber: number;
    previousEventHash: string | null;
  }): string {
    const data = [
      params.orgId,
      params.baggageId,
      params.eventType,
      params.eventSource,
      params.occurredAt,
      String(params.sequenceNumber),
      params.previousEventHash ?? 'genesis',
    ].join('|');

    return createHash('sha256').update(data).digest('hex');
  }
}

export const eventService = new EventService();
