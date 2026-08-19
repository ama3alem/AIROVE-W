import { db, baggageCustody, baggage, baggageStateProjections } from '@airove/db';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from './logger.js';
import { auditLog } from './audit-logger.js';
import { eventService } from './event-service.js';
import type { CustodyPartyType, OperationalEventType } from '@airove/shared';

export interface CreateCustodyInput {
  orgId: string;
  baggageId: string;
  flightId?: string;
  custodianName: string;
  custodianType: CustodyPartyType;
  location?: string;
  airportCode?: string;
  handoverId?: string;
  notes?: string;
  transferredBy?: string;
  transferredAt?: Date;
}

export class CustodyService {
  async getCurrentCustody(baggageId: string, orgId: string) {
    const record = await db.query.baggageCustody.findFirst({
      where: eq(baggageCustody.baggageId, baggageId),
      orderBy: [desc(baggageCustody.transferredAt)],
    });

    return record ?? null;
  }

  async getCustodyHistory(baggageId: string, orgId: string) {
    return db.query.baggageCustody.findMany({
      where: and(
        eq(baggageCustody.baggageId, baggageId),
        eq(baggageCustody.orgId, orgId),
      ),
      orderBy: [desc(baggageCustody.transferredAt)],
    });
  }

  async transferCustody(input: CreateCustodyInput) {
    const currentCustody = await this.getCurrentCustody(input.baggageId, input.orgId);

    const previousCustodian = currentCustody?.custodianName ?? null;
    const previousCustodianType = currentCustody?.custodianType ?? null;

    const result = await db.insert(baggageCustody).values({
      orgId: input.orgId,
      baggageId: input.baggageId,
      flightId: input.flightId ?? null,
      custodianName: input.custodianName,
      custodianType: input.custodianType,
      previousCustodian,
      previousCustodianType,
      location: input.location ?? null,
      airportCode: input.airportCode ?? null,
      transferredAt: input.transferredAt ?? new Date(),
      transferredBy: input.transferredBy ?? null,
      handoverId: input.handoverId ?? null,
      notes: input.notes ?? null,
    }).returning();

    const record = result[0];
    if (!record) {
      throw new Error('Failed to create custody record');
    }

    await db
      .update(baggage)
      .set({
        currentCustodian: input.custodianName,
        currentCustodianType: input.custodianType,
        updatedAt: new Date(),
      })
      .where(eq(baggage.id, input.baggageId));

    await eventService.upsertStateProjection({
      orgId: input.orgId,
      baggageId: input.baggageId,
      currentState: (await eventService.getStateProjection(input.baggageId, input.orgId))?.currentState as 'created' ?? 'created',
      currentCustodian: input.custodianName,
      currentCustodianType: input.custodianType,
    });

    await eventService.createEvent({
      orgId: input.orgId,
      baggageId: input.baggageId,
      flightId: input.flightId,
      eventType: 'baggage_custody_changed' as OperationalEventType,
      eventSource: 'system',
      actorType: input.transferredBy ? 'user' : 'system',
      actorId: input.transferredBy,
      location: input.location,
      airportCode: input.airportCode,
      metadata: {
        fromCustodian: previousCustodian,
        fromCustodianType: previousCustodianType,
        toCustodian: input.custodianName,
        toCustodianType: input.custodianType,
        handoverId: input.handoverId,
      },
      occurredAt: input.transferredAt ?? new Date(),
    });

    await auditLog({
      orgId: input.orgId,
      userId: input.transferredBy,
      action: 'baggage:custody.transfer',
      entityType: 'baggage_custody',
      entityId: record.id,
      entityRef: `${previousCustodian ?? 'none'} → ${input.custodianName}`,
    });

    logger.info(
      { baggageId: input.baggageId, from: previousCustodian, to: input.custodianName },
      'Custody transferred',
    );

    return record;
  }

  async assignInitialCustody(input: CreateCustodyInput) {
    const existing = await this.getCurrentCustody(input.baggageId, input.orgId);
    if (existing) {
      return this.transferCustody(input);
    }

    const result = await db.insert(baggageCustody).values({
      orgId: input.orgId,
      baggageId: input.baggageId,
      flightId: input.flightId ?? null,
      custodianName: input.custodianName,
      custodianType: input.custodianType,
      previousCustodian: null,
      previousCustodianType: null,
      location: input.location ?? null,
      airportCode: input.airportCode ?? null,
      transferredAt: input.transferredAt ?? new Date(),
      transferredBy: input.transferredBy ?? null,
      handoverId: input.handoverId ?? null,
      notes: input.notes ?? null,
    }).returning();

    const record = result[0];
    if (!record) {
      throw new Error('Failed to create initial custody record');
    }

    await db
      .update(baggage)
      .set({
        currentCustodian: input.custodianName,
        currentCustodianType: input.custodianType,
        updatedAt: new Date(),
      })
      .where(eq(baggage.id, input.baggageId));

    return record;
  }
}

export const custodyService = new CustodyService();
