import { Hono } from 'hono';
import { authMiddleware, requirePermission } from '../middleware/auth';
import type { AppEnv } from '../types/env';
import { createExportSchema } from '@airove/shared';
import { exportService } from '../lib/export-service';
import { auditLog } from '../lib/audit-logger';

const exportsRoutes = new Hono<AppEnv>();

exportsRoutes.use('*', authMiddleware);

exportsRoutes.get(
  '/',
  requirePermission('analytics:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const userId = c.req.query('userId');

    const exports = await exportService.listExports(orgId, userId);

    return c.json({
      success: true,
      data: exports,
    });
  },
);

exportsRoutes.get(
  '/:exportId',
  requirePermission('analytics:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const exportId = c.req.param('exportId');

    const exportRecord = await exportService.getExport(orgId, exportId);

    if (!exportRecord) {
      return c.json({ success: false, error: 'Export not found' }, 404);
    }

    return c.json({
      success: true,
      data: exportRecord,
    });
  },
);

exportsRoutes.post(
  '/',
  requirePermission('analytics:export'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const userId = authCtx.userId;
    const body = await c.req.json();
    const validated = createExportSchema.parse(body);

    const exportRecord = await exportService.createExport(orgId, {
      userId,
      ...validated,
      format: validated.format as 'csv' | 'json',
    });

    await auditLog({
      orgId,
      userId,
      action: 'export.create',
      entityType: 'export',
      entityId: exportRecord.id,
      changes: JSON.stringify({ exportType: validated.exportType, format: validated.format }),
    });

    return c.json({
      success: true,
      data: exportRecord,
    }, 201);
  },
);

exportsRoutes.post(
  '/:exportId/process',
  requirePermission('analytics:export'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const userId = authCtx.userId;
    const exportId = c.req.param('exportId');

    const exportRecord = await exportService.getExport(orgId, exportId);

    if (!exportRecord) {
      return c.json({ success: false, error: 'Export not found' }, 404);
    }

    if (exportRecord.status !== 'pending') {
      return c.json({ success: false, error: 'Export already processed' }, 400);
    }

    await exportService.updateExportStatus(orgId, exportId, { status: 'processing' });

    try {
      const { data, rowCount } = await exportService.generateExportData(
        orgId,
        exportRecord.exportType,
        exportRecord.filters as Record<string, unknown>,
      );

      const formatted = exportService.formatExportData(data, exportRecord.format);

      await exportService.updateExportStatus(orgId, exportId, {
        status: 'completed',
        rowCount,
      });

      await auditLog({
        orgId,
        userId,
        action: 'export.complete',
        entityType: 'export',
        entityId: exportId,
        changes: JSON.stringify({ rowCount }),
      });

      return c.json({
        success: true,
        data: {
          export: await exportService.getExport(orgId, exportId),
          content: formatted,
        },
      });
    } catch (error) {
      await exportService.updateExportStatus(orgId, exportId, {
        status: 'failed',
      });

      return c.json({ success: false, error: 'Export processing failed' }, 500);
    }
  },
);

exportsRoutes.delete(
  '/:exportId',
  requirePermission('analytics:export'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const userId = authCtx.userId;
    const exportId = c.req.param('exportId');

    const deleted = await exportService.deleteExport(orgId, exportId);

    if (!deleted) {
      return c.json({ success: false, error: 'Export not found' }, 404);
    }

    await auditLog({
      orgId,
      userId,
      action: 'export.delete',
      entityType: 'export',
      entityId: exportId,
      changes: JSON.stringify({}),
    });

    return c.json({
      success: true,
      message: 'Export deleted successfully',
    });
  },
);

export { exportsRoutes };
