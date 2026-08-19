import { Hono } from 'hono';
import { z } from 'zod';
import { db, integrations, integrationEvents } from '@airove/db';
import { eq, and } from 'drizzle-orm';
import {
  createIntegrationSchema,
  updateIntegrationSchema,
  webhookEventSchema,
  paginationSchema,
  replayEventSchema,
} from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { webhookAuthMiddleware, type WebhookContext } from '../middleware/webhook-auth';
import { rateLimiter } from '../middleware/rate-limiter';
import { integrationService } from '../lib/integration-service';
import { normalizationEngine, type RawInboundEvent } from '../lib/normalization';
import { integrationEventQueue } from '../workers/integration-event-worker';
import { replayEvent } from '../workers/integration-event-worker';
import { auditLog } from '../lib/audit-logger';
import type { AppEnv } from '../types/env';

const integrationRoutes = new Hono<AppEnv>();

integrationRoutes.use('*', rateLimiter({ maxRequests: 60 }));
integrationRoutes.use('*', authMiddleware);

integrationRoutes.get('/', requirePermission(PERMISSIONS.INTEGRATION_READ), async (c) => {
  const authCtx = c.get('auth');
  const all = await integrationService.listByOrg(authCtx.orgId);
  return c.json({ success: true, data: all });
});

integrationRoutes.post('/', requirePermission(PERMISSIONS.INTEGRATION_CREATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createIntegrationSchema.parse(body);

  const integration = await integrationService.create({
    orgId: authCtx.orgId,
    name: validated.name,
    type: validated.type,
    provider: validated.provider,
    config: validated.config,
    mappingConfig: validated.mappingConfig,
  });

  return c.json({ success: true, data: integration }, 201);
});

integrationRoutes.get('/:id', requirePermission(PERMISSIONS.INTEGRATION_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const integration = await integrationService.getById(id, authCtx.orgId);
  if (!integration) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Integration not found' } },
      404,
    );
  }

  return c.json({ success: true, data: integration });
});

integrationRoutes.patch('/:id', requirePermission(PERMISSIONS.INTEGRATION_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = updateIntegrationSchema.parse(body);

  const updated = await integrationService.update(id, authCtx.orgId, validated);
  if (!updated) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Integration not found' } },
      404,
    );
  }

  return c.json({ success: true, data: updated });
});

integrationRoutes.delete('/:id', requirePermission(PERMISSIONS.INTEGRATION_DELETE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const deleted = await integrationService.delete(id, authCtx.orgId);
  if (!deleted) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Integration not found' } },
      404,
    );
  }

  return c.json({ success: true });
});

integrationRoutes.post('/:id/activate', requirePermission(PERMISSIONS.INTEGRATION_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const updated = await integrationService.activate(id, authCtx.orgId);
  if (!updated) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Integration not found' } },
      404,
    );
  }

  return c.json({ success: true, data: updated });
});

integrationRoutes.post('/:id/pause', requirePermission(PERMISSIONS.INTEGRATION_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const updated = await integrationService.pause(id, authCtx.orgId);
  if (!updated) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Integration not found' } },
      404,
    );
  }

  return c.json({ success: true, data: updated });
});

integrationRoutes.post('/:id/rotate-credentials', requirePermission(PERMISSIONS.INTEGRATION_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const result = await integrationService.rotateCredentials(id, authCtx.orgId);
  if (!result) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Integration not found' } },
      404,
    );
  }

  return c.json({ success: true, data: { message: 'Credentials rotated', webhookSecret: result.webhookSecret } });
});

integrationRoutes.get('/:id/health', requirePermission(PERMISSIONS.INTEGRATION_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const health = await integrationService.getHealth(id, authCtx.orgId);
  if (!health) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Integration not found' } },
      404,
    );
  }

  return c.json({ success: true, data: health });
});

integrationRoutes.get('/:id/events', requirePermission(PERMISSIONS.INTEGRATION_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const { page, pageSize } = paginationSchema.parse(c.req.query());

  const events = await integrationService.listEvents(id, authCtx.orgId, page, pageSize);
  return c.json({ success: true, data: events });
});

integrationRoutes.get('/:id/failures', requirePermission(PERMISSIONS.INTEGRATION_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const failures = await integrationService.listQuarantinedEvents(id, authCtx.orgId);
  return c.json({ success: true, data: failures });
});

integrationRoutes.post('/:id/test', requirePermission(PERMISSIONS.INTEGRATION_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const integration = await integrationService.getById(id, authCtx.orgId);
  if (!integration) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Integration not found' } },
      404,
    );
  }

  await auditLog({
    orgId: authCtx.orgId,
    userId: authCtx.userId,
    action: 'integration.test',
    entityType: 'integration',
    entityId: id,
  });

  return c.json({
    success: true,
    data: {
      status: 'ok',
      integrationId: id,
      type: integration.type,
      provider: integration.provider,
    },
  });
});

integrationRoutes.post('/:id/replay', requirePermission(PERMISSIONS.INTEGRATION_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = replayEventSchema.parse(body);

  try {
    await replayEvent(validated.eventId, authCtx.orgId);

    await auditLog({
      orgId: authCtx.orgId,
      userId: authCtx.userId,
      action: 'integration.replay',
      entityType: 'integration_event',
      entityId: validated.eventId,
      changes: JSON.stringify({ integrationId: id }),
    });

    return c.json({ success: true, data: { message: 'Event queued for replay' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Replay failed';
    return c.json(
      { success: false, error: { code: 'REPLAY_FAILED', message } },
      400,
    );
  }
});

integrationRoutes.get('/:id/deliveries', requirePermission(PERMISSIONS.INTEGRATION_READ), async (c) => {
  const authCtx = c.get('auth');
  const { id } = c.req.param();

  const deliveries = await integrationService.listOutboundDeliveries(id, authCtx.orgId);
  return c.json({ success: true, data: deliveries });
});

// Webhook endpoint — uses webhook auth, not user auth
const webhookRoutes = new Hono<AppEnv>();

webhookRoutes.post('/:id/webhook', webhookAuthMiddleware, async (c) => {
  const webhookCtx = c.get('webhookContext') as WebhookContext;
  const body = await c.req.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return c.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      400,
    );
  }

  const eventId = (parsed as Record<string, unknown>)?.['event_id']
    ?? (parsed as Record<string, unknown>)?.['id']
    ?? `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const eventType = (parsed as Record<string, unknown>)?.['event_type']
    ?? (parsed as Record<string, unknown>)?.['type']
    ?? 'unknown';

  const existing = await db.query.integrationEvents.findFirst({
    where: and(
      eq(integrationEvents.integrationId, webhookCtx.integrationId),
      eq(integrationEvents.externalEventId, String(eventId)),
    ),
  });

  if (existing) {
    return c.json({ success: true, data: { eventId: existing.id, status: 'duplicate_ignored' } });
  }

  const inboundEvent = await integrationService.createInboundEvent({
    integrationId: webhookCtx.integrationId,
    orgId: webhookCtx.orgId,
    externalEventId: String(eventId),
    eventType: String(eventType),
    rawPayload: body,
    correlationId: c.req.header('x-correlation-id') ?? undefined,
  });

  if (!inboundEvent) {
    return c.json(
      { success: false, error: { code: 'CREATE_FAILED', message: 'Failed to record event' } },
      500,
    );
  }

  await integrationService.recordEventReceived(webhookCtx.integrationId, webhookCtx.orgId);

  await integrationEventQueue.add(
    'process-integration-event',
    {
      eventId: inboundEvent.id,
      integrationId: webhookCtx.integrationId,
      orgId: webhookCtx.orgId,
    },
    {
      jobId: `webhook_${webhookCtx.integrationId}_${eventId}`,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  );

  return c.json({
    success: true,
    data: {
      eventId: inboundEvent.id,
      status: 'received',
      correlationId: inboundEvent.correlationId,
    },
  }, 202);
});

export { integrationRoutes, webhookRoutes };
