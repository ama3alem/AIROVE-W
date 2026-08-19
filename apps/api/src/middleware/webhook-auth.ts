import type { MiddlewareHandler } from 'hono';
import { createHmac, timingSafeEqual } from 'crypto';
import { db, integrations } from '@airove/db';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { MAX_WEBHOOK_PAYLOAD_SIZE, WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS } from '@airove/shared';
import type { AppEnv } from '../types/env';

export interface WebhookContext {
  integrationId: string;
  orgId: string;
  integrationName: string;
  provider?: string;
}

export const webhookAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const integrationId = c.req.param('id');

  if (!integrationId) {
    return c.json(
      { success: false, error: { code: 'MISSING_ID', message: 'Integration ID required' } },
      400,
    );
  }

  const integration = await db.query.integrations.findFirst({
    where: eq(integrations.id, integrationId),
  });

  if (!integration) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Integration not found' } },
      404,
    );
  }

  if (integration.status !== 'active') {
    return c.json(
      { success: false, error: { code: 'INTEGRATION_INACTIVE', message: 'Integration is not active' } },
      403,
    );
  }

  if (!integration.webhookSecret) {
    logger.warn({ integrationId }, 'Webhook received but no secret configured');
    return c.json(
      { success: false, error: { code: 'NO_SECRET', message: 'Webhook authentication not configured' } },
      500,
    );
  }

  const body = await c.req.text();

  if (body.length > MAX_WEBHOOK_PAYLOAD_SIZE) {
    return c.json(
      { success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload exceeds size limit' } },
      413,
    );
  }

  const signature = c.req.header('x-webhook-signature') ?? c.req.header('x-hub-signature-256');

  if (!signature) {
    return c.json(
      { success: false, error: { code: 'MISSING_SIGNATURE', message: 'Webhook signature required' } },
      401,
    );
  }

  const expectedSig = createHmac('sha256', integration.webhookSecret)
    .update(body)
    .digest('hex');

  const sigValue = signature.replace(/^sha256=/, '');

  try {
    const expected = Buffer.from(expectedSig, 'hex');
    const received = Buffer.from(sigValue, 'hex');

    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      logger.warn({ integrationId }, 'Invalid webhook signature');
      return c.json(
        { success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } },
        401,
      );
    }
  } catch {
    return c.json(
      { success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature format' } },
      401,
    );
  }

  const timestamp = c.req.header('x-webhook-timestamp');
  if (timestamp) {
    const ts = parseInt(timestamp, 10);
    if (!isNaN(ts)) {
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - ts) > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) {
        logger.warn({ integrationId, timestamp, now }, 'Webhook timestamp out of tolerance');
        return c.json(
          { success: false, error: { code: 'STALE_WEBHOOK', message: 'Webhook timestamp out of tolerance' } },
          401,
        );
      }
    }
  }

  c.set('webhookContext', {
    integrationId: integration.id,
    orgId: integration.orgId,
    integrationName: integration.name,
    provider: integration.provider ?? undefined,
  } satisfies WebhookContext);

  await next();
};
