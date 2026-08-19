import { Hono } from 'hono';
import { authMiddleware, requirePermission } from '../middleware/auth';
import type { AppEnv } from '../types/env';
import { commandCenterService } from '../lib/command-center-service';

const commandCenterRoutes = new Hono<AppEnv>();

commandCenterRoutes.use('*', authMiddleware);

commandCenterRoutes.get(
  '/overview',
  requirePermission('command_center:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const airportCode = c.req.query('airportCode');

    const overview = await commandCenterService.getOverview(
      orgId,
      airportCode,
    );

    return c.json({
      success: true,
      data: overview,
    });
  },
);

commandCenterRoutes.get(
  '/airports/health',
  requirePermission('command_center:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;

    const health = await commandCenterService.getAirportHealth(orgId);

    return c.json({
      success: true,
      data: health,
    });
  },
);

export { commandCenterRoutes };
