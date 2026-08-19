import {
  db,
  integrations,
  integrationEvents,
  entityMappings,
  outboundDeliveries,
} from '@airove/db';
import { eq, and, sql, desc } from 'drizzle-orm';
import { createHash, randomBytes, createHmac } from 'crypto';
import { logger } from './logger';
import { auditLog } from './audit-logger';
import type { IntegrationMapping, IntegrationHealth, NormalizedEvent } from '@airove/shared';

export interface CreateIntegrationInput {
  orgId: string;
  name: string;
  type: string;
  provider?: string;
  config?: string;
  mappingConfig?: Record<string, unknown>;
}

export class IntegrationService {
  async create(input: CreateIntegrationInput) {
    const webhookSecret = input.type === 'webhook'
      ? `whsec_${randomBytes(32).toString('hex')}`
      : null;

    const result = await db.insert(integrations).values({
      orgId: input.orgId,
      name: input.name,
      type: input.type,
      provider: input.provider ?? 'generic',
      config: input.config ?? null,
      mappingConfig: input.mappingConfig ?? null,
      webhookSecret,
      status: 'configuring',
    }).returning();

    const integration = result[0];

    if (!integration) {
      throw new Error('Failed to create integration');
    }

    await auditLog({
      orgId: input.orgId,
      action: 'integration.create',
      entityType: 'integration',
      entityId: integration.id,
      entityRef: input.name,
    });

    return integration;
  }

  async getById(integrationId: string, orgId: string) {
    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.id, integrationId),
        eq(integrations.orgId, orgId),
      ),
    });

    if (!integration) return null;

    return {
      ...integration,
      webhookSecret: undefined,
      credentialRef: undefined,
    };
  }

  async listByOrg(orgId: string) {
    const all = await db.query.integrations.findMany({
      where: eq(integrations.orgId, orgId),
      orderBy: [desc(integrations.createdAt)],
    });

    return all.map((i) => ({
      ...i,
      webhookSecret: undefined,
      credentialRef: undefined,
    }));
  }

  async update(
    integrationId: string,
    orgId: string,
    data: Record<string, unknown>,
  ) {
    const [updated] = await db
      .update(integrations)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(eq(integrations.id, integrationId), eq(integrations.orgId, orgId)),
      )
      .returning();

    if (!updated) return null;

    await auditLog({
      orgId,
      action: 'integration.update',
      entityType: 'integration',
      entityId: integrationId,
      changes: JSON.stringify(data),
    });

    return updated;
  }

  async delete(integrationId: string, orgId: string) {
    const [deleted] = await db
      .delete(integrations)
      .where(
        and(eq(integrations.id, integrationId), eq(integrations.orgId, orgId)),
      )
      .returning();

    if (!deleted) return null;

    await auditLog({
      orgId,
      action: 'integration.delete',
      entityType: 'integration',
      entityId: integrationId,
    });

    return deleted;
  }

  async activate(integrationId: string, orgId: string) {
    return this.update(integrationId, orgId, { status: 'active' });
  }

  async pause(integrationId: string, orgId: string) {
    return this.update(integrationId, orgId, { status: 'paused' });
  }

  async rotateCredentials(integrationId: string, orgId: string) {
    const integration = await this.getById(integrationId, orgId);
    if (!integration) return null;

    const newSecret = `whsec_${randomBytes(32).toString('hex')}`;

    const [updated] = await db
      .update(integrations)
      .set({ webhookSecret: newSecret, updatedAt: new Date() })
      .where(
        and(eq(integrations.id, integrationId), eq(integrations.orgId, orgId)),
      )
      .returning();

    await auditLog({
      orgId,
      action: 'integration.rotate_credentials',
      entityType: 'integration',
      entityId: integrationId,
    });

    return { webhookSecret: newSecret };
  }

  async recordEventReceived(integrationId: string, orgId: string) {
    await db
      .update(integrations)
      .set({
        totalEventsReceived: sql`${integrations.totalEventsReceived} + 1`,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));
  }

  async recordEventFailed(integrationId: string, orgId: string, error: string) {
    await db
      .update(integrations)
      .set({
        totalEventsFailed: sql`${integrations.totalEventsFailed} + 1`,
        consecutiveFailures: sql`${integrations.consecutiveFailures} + 1`,
        lastErrorAt: new Date(),
        lastError: error,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, integrationId));
  }

  async resetConsecutiveFailures(integrationId: string) {
    await db
      .update(integrations)
      .set({ consecutiveFailures: 0, updatedAt: new Date() })
      .where(eq(integrations.id, integrationId));
  }

  async getHealth(integrationId: string, orgId: string): Promise<IntegrationHealth | null> {
    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.id, integrationId),
        eq(integrations.orgId, orgId),
      ),
    });

    if (!integration) return null;

    const totalReceived = integration.totalEventsReceived ?? 0;
    const totalFailed = integration.totalEventsFailed ?? 0;
    const failureRate = totalReceived > 0 ? totalFailed / totalReceived : 0;

    return {
      integrationId: integration.id,
      status: integration.status as IntegrationHealth['status'],
      lastSuccessAt: integration.lastSyncAt?.toISOString(),
      lastFailureAt: integration.lastErrorAt?.toISOString(),
      lastError: integration.lastError ?? undefined,
      failureRate,
      totalReceived,
      totalFailed,
      consecutiveFailures: integration.consecutiveFailures ?? 0,
    };
  }

  async createInboundEvent(params: {
    integrationId: string;
    orgId: string;
    externalEventId: string;
    eventType: string;
    rawPayload: string;
    correlationId?: string;
  }) {
    const result = await db.insert(integrationEvents).values({
      integrationId: params.integrationId,
      orgId: params.orgId,
      externalEventId: params.externalEventId,
      eventType: params.eventType,
      status: 'received',
      rawPayload: params.rawPayload,
      correlationId: params.correlationId,
    }).returning();

    return result[0] ?? null;
  }

  async updateEventStatus(
    eventId: string,
    status: string,
    data?: Record<string, unknown>,
  ) {
    const updateData: Record<string, unknown> = { status, ...data };

    if (status === 'processed') updateData['processedAt'] = new Date();
    if (status === 'failed' || status === 'quarantined') updateData['failedAt'] = new Date();

    const [updated] = await db
      .update(integrationEvents)
      .set(updateData)
      .where(eq(integrationEvents.id, eventId))
      .returning();

    return updated ?? null;
  }

  async getEventById(eventId: string) {
    return db.query.integrationEvents.findFirst({
      where: eq(integrationEvents.id, eventId),
    });
  }

  async listEvents(integrationId: string, orgId: string, page = 1, pageSize = 20) {
    return db.query.integrationEvents.findMany({
      where: and(
        eq(integrationEvents.integrationId, integrationId),
        eq(integrationEvents.orgId, orgId),
      ),
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: [desc(integrationEvents.receivedAt)],
    });
  }

  async listQuarantinedEvents(integrationId: string, orgId: string) {
    return db.query.integrationEvents.findMany({
      where: and(
        eq(integrationEvents.integrationId, integrationId),
        eq(integrationEvents.orgId, orgId),
        eq(integrationEvents.status, 'quarantined'),
      ),
      orderBy: [desc(integrationEvents.failedAt)],
    });
  }

  async resolveEntity(
    integrationId: string,
    entityType: string,
    externalId: string,
  ): Promise<string | null> {
    const mapping = await db.query.entityMappings.findFirst({
      where: and(
        eq(entityMappings.integrationId, integrationId),
        eq(entityMappings.entityType, entityType),
        eq(entityMappings.externalId, externalId),
      ),
    });

    return mapping?.internalId ?? null;
  }

  async createEntityMapping(
    orgId: string,
    integrationId: string,
    entityType: string,
    externalId: string,
    internalId: string,
  ) {
    const result = await db.insert(entityMappings).values({
      orgId,
      integrationId,
      entityType,
      externalId,
      internalId,
    }).returning();

    return result[0] ?? null;
  }

  async verifyWebhookSignature(
    integrationId: string,
    payload: string,
    signature: string,
  ): Promise<boolean> {
    const integration = await db.query.integrations.findFirst({
      where: eq(integrations.id, integrationId),
    });

    if (!integration?.webhookSecret) return false;

    const expected = createHmac('sha256', integration.webhookSecret)
      .update(payload)
      .digest('hex');

    return createHmac('sha256', integration.webhookSecret)
      .update(payload)
      .digest('hex') === signature;
  }

  async createOutboundDelivery(params: {
    integrationId: string;
    orgId: string;
    eventType: string;
    payload: string;
    correlationId?: string;
  }) {
    const result = await db.insert(outboundDeliveries).values({
      integrationId: params.integrationId,
      orgId: params.orgId,
      eventType: params.eventType,
      payload: params.payload,
      correlationId: params.correlationId,
      status: 'pending',
    }).returning();

    return result[0] ?? null;
  }

  async listOutboundDeliveries(integrationId: string, orgId: string) {
    return db.query.outboundDeliveries.findMany({
      where: and(
        eq(outboundDeliveries.integrationId, integrationId),
        eq(outboundDeliveries.orgId, orgId),
      ),
      orderBy: [desc(outboundDeliveries.createdAt)],
    });
  }
}

export const integrationService = new IntegrationService();
