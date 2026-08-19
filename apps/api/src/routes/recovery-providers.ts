import { Hono } from 'hono';
import { PERMISSIONS } from '@airove/shared';
import { createRecoveryProviderSchema, updateRecoveryProviderSchema, createProviderServiceSchema } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limiter';
import { recoveryProviderService as providerService } from '../lib/recovery-provider-service';
import type { AppEnv } from '../types/env';

export const recoveryProviderRoutes = new Hono<AppEnv>();

recoveryProviderRoutes.use('*', rateLimiter({ maxRequests: 60 }));
recoveryProviderRoutes.use('*', authMiddleware);

recoveryProviderRoutes.get('/', requirePermission(PERMISSIONS.RECOVERY_PROVIDER_READ), async (c) => {
  const authCtx = c.get('auth');
  const result = await providerService.listProviders(authCtx.orgId);
  return c.json({ success: true, data: result });
});

recoveryProviderRoutes.get('/:providerId', requirePermission(PERMISSIONS.RECOVERY_PROVIDER_READ), async (c) => {
  const authCtx = c.get('auth');
  const providerId = c.req.param('providerId');
  const provider = await providerService.getProvider(providerId, authCtx.orgId);
  return c.json({ success: true, data: provider });
});

recoveryProviderRoutes.post('/', requirePermission(PERMISSIONS.RECOVERY_PROVIDER_CREATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createRecoveryProviderSchema.parse(body);

  const provider = await providerService.createProvider(
    {
      name: validated.name,
      description: validated.description,
      coverage: validated.coverage,
      contactEmail: validated.contactEmail,
      contactPhone: validated.contactPhone,
      metadata: validated.metadata,
    },
    authCtx.orgId,
    authCtx.userId,
  );

  return c.json({ success: true, data: provider }, 201);
});

recoveryProviderRoutes.put('/:providerId', requirePermission(PERMISSIONS.RECOVERY_PROVIDER_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const providerId = c.req.param('providerId');
  const body = await c.req.json();
  const validated = updateRecoveryProviderSchema.parse(body);

  const provider = await providerService.updateProvider(providerId, authCtx.orgId, validated, authCtx.userId);
  return c.json({ success: true, data: provider });
});

recoveryProviderRoutes.get('/:providerId/services', requirePermission(PERMISSIONS.RECOVERY_PROVIDER_READ), async (c) => {
  const authCtx = c.get('auth');
  const providerId = c.req.param('providerId');
  const services = await providerService.listServices(providerId, authCtx.orgId);
  return c.json({ success: true, data: services });
});

recoveryProviderRoutes.post('/:providerId/services', requirePermission(PERMISSIONS.RECOVERY_PROVIDER_CREATE), async (c) => {
  const authCtx = c.get('auth');
  const providerId = c.req.param('providerId');
  const body = await c.req.json();
  const validated = createProviderServiceSchema.parse(body);

  const service = await providerService.createService(
    providerId,
    authCtx.orgId,
    {
      serviceName: validated.serviceName,
      serviceType: validated.serviceType,
      coverage: validated.coverage,
      estimatedDurationMinutes: validated.estimatedDurationMinutes,
      cost: validated.cost,
      capacity: validated.capacity,
      metadata: validated.metadata,
    },
  );

  return c.json({ success: true, data: service }, 201);
});
