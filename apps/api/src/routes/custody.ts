import { Hono } from 'hono';
import { db, baggageCustody } from '@airove/db';
import { eq, and, desc } from 'drizzle-orm';
import { createCustodySchema, paginationSchema } from '@airove/shared';
import { PERMISSIONS } from '@airove/shared';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { custodyService } from '../lib/custody-service.js';
import type { AppEnv } from '../types/env.js';

export const custodyRoutes = new Hono<AppEnv>();

custodyRoutes.use('*', rateLimiter({ maxRequests: 60 }));
custodyRoutes.use('*', authMiddleware);

custodyRoutes.post('/', requirePermission(PERMISSIONS.BAGGAGE_UPDATE), async (c) => {
  const authCtx = c.get('auth');
  const body = await c.req.json();
  const validated = createCustodySchema.parse(body);

  const record = await custodyService.transferCustody({
    orgId: authCtx.orgId,
    baggageId: validated.baggageId,
    flightId: validated.flightId,
    custodianName: validated.custodianName,
    custodianType: validated.custodianType as 'airline' | 'airport' | 'ground_handler' | 'transfer_team' | 'recovery_provider' | 'delivery_provider' | 'traveler' | 'system',
    location: validated.location,
    airportCode: validated.airportCode,
    handoverId: validated.handoverId,
    notes: validated.notes,
    transferredBy: authCtx.userId,
    transferredAt: validated.transferredAt ? new Date(validated.transferredAt) : undefined,
  });

  return c.json({ success: true, data: record }, 201);
});

custodyRoutes.get('/baggage/:baggageId', requirePermission(PERMISSIONS.BAGGAGE_READ), async (c) => {
  const authCtx = c.get('auth');
  const { baggageId } = c.req.param();

  const current = await custodyService.getCurrentCustody(baggageId, authCtx.orgId);
  const history = await custodyService.getCustodyHistory(baggageId, authCtx.orgId);

  return c.json({
    success: true,
    data: {
      currentCustody: current,
      custodyHistory: history,
    },
  });
});
