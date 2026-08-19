import { Hono } from 'hono';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import type { AppEnv } from '../types/env.js';
import {
  createSavedViewSchema,
  updateSavedViewSchema,
} from '@airove/shared';
import { savedViewsService } from '../lib/saved-views-service.js';
import { auditLog } from '../lib/audit-logger.js';

const savedViewsRoutes = new Hono<AppEnv>();

savedViewsRoutes.use('*', authMiddleware);

savedViewsRoutes.get(
  '/',
  requirePermission('analytics:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const userId = c.req.query('userId');

    const views = await savedViewsService.listSavedViews(orgId, userId);

    return c.json({
      success: true,
      data: views,
    });
  },
);

savedViewsRoutes.get(
  '/:viewId',
  requirePermission('analytics:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const viewId = c.req.param('viewId');

    const view = await savedViewsService.getSavedView(orgId, viewId);

    if (!view) {
      return c.json({ success: false, error: 'View not found' }, 404);
    }

    return c.json({
      success: true,
      data: view,
    });
  },
);

savedViewsRoutes.post(
  '/',
  requirePermission('analytics_saved_view:create'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const userId = authCtx.userId;
    const body = await c.req.json();
    const validated = createSavedViewSchema.parse(body);

    const view = await savedViewsService.createSavedView(orgId, {
      userId,
      ...validated,
    });

    await auditLog({
      orgId,
      userId,
      action: 'saved_view.create',
      entityType: 'saved_view',
      entityId: view.id,
      changes: JSON.stringify({ viewName: validated.viewName }),
    });

    return c.json({
      success: true,
      data: view,
    }, 201);
  },
);

savedViewsRoutes.put(
  '/:viewId',
  requirePermission('analytics_saved_view:manage'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const userId = authCtx.userId;
    const viewId = c.req.param('viewId');
    const body = await c.req.json();
    const validated = updateSavedViewSchema.parse(body);

    const view = await savedViewsService.updateSavedView(orgId, viewId, validated);

    if (!view) {
      return c.json({ success: false, error: 'View not found' }, 404);
    }

    await auditLog({
      orgId,
      userId,
      action: 'saved_view.update',
      entityType: 'saved_view',
      entityId: viewId,
      changes: JSON.stringify(validated),
    });

    return c.json({
      success: true,
      data: view,
    });
  },
);

savedViewsRoutes.delete(
  '/:viewId',
  requirePermission('analytics_saved_view:manage'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const userId = authCtx.userId;
    const viewId = c.req.param('viewId');

    const deleted = await savedViewsService.deleteSavedView(orgId, viewId);

    if (!deleted) {
      return c.json({ success: false, error: 'View not found' }, 404);
    }

    await auditLog({
      orgId,
      userId,
      action: 'saved_view.delete',
      entityType: 'saved_view',
      entityId: viewId,
      changes: JSON.stringify({}),
    });

    return c.json({
      success: true,
      message: 'View deleted successfully',
    });
  },
);

export { savedViewsRoutes };
