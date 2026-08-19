import { Hono } from 'hono';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import type { AppEnv } from '../types/env.js';
import {
  createAlertRuleSchema,
  updateAlertRuleSchema,
} from '@airove/shared';
import { alertEngineService } from '../lib/alert-engine.js';
import { auditLog } from '../lib/audit-logger.js';

const alertsRoutes = new Hono<AppEnv>();

alertsRoutes.use('*', authMiddleware);

alertsRoutes.get(
  '/rules',
  requirePermission('analytics_alert:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const metricName = c.req.query('metricName');

    const rules = await alertEngineService.listAlertRules(orgId, metricName);

    return c.json({
      success: true,
      data: rules,
    });
  },
);

alertsRoutes.post(
  '/rules',
  requirePermission('analytics:manage'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const userId = authCtx.userId;
    const body = await c.req.json();
    const validated = createAlertRuleSchema.parse(body);

    const rule = await alertEngineService.createAlertRule(orgId, {
      ...validated,
      severity: validated.severity as 'info' | 'warning' | 'critical',
      createdBy: userId,
    });

    await auditLog({
      orgId,
      userId,
      action: 'alert_rule.create',
      entityType: 'alert_rule',
      entityId: rule.id,
      changes: JSON.stringify({ ruleName: validated.ruleName, metricName: validated.metricName }),
    });

    return c.json({
      success: true,
      data: rule,
    }, 201);
  },
);

alertsRoutes.put(
  '/rules/:ruleId',
  requirePermission('analytics:manage'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const userId = authCtx.userId;
    const ruleId = c.req.param('ruleId');
    const body = await c.req.json();
    const validated = updateAlertRuleSchema.parse(body);

    const rule = await alertEngineService.updateAlertRule(orgId, ruleId, {
      ...validated,
      severity: validated.severity as 'info' | 'warning' | 'critical' | undefined,
    });

    if (!rule) {
      return c.json({ success: false, error: 'Rule not found' }, 404);
    }

    await auditLog({
      orgId,
      userId,
      action: 'alert_rule.update',
      entityType: 'alert_rule',
      entityId: ruleId,
      changes: JSON.stringify(validated),
    });

    return c.json({
      success: true,
      data: rule,
    });
  },
);

alertsRoutes.delete(
  '/rules/:ruleId',
  requirePermission('analytics:manage'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const userId = authCtx.userId;
    const ruleId = c.req.param('ruleId');

    const deleted = await alertEngineService.deleteAlertRule(orgId, ruleId);

    if (!deleted) {
      return c.json({ success: false, error: 'Rule not found' }, 404);
    }

    await auditLog({
      orgId,
      userId,
      action: 'alert_rule.delete',
      entityType: 'alert_rule',
      entityId: ruleId,
      changes: JSON.stringify({}),
    });

    return c.json({
      success: true,
      message: 'Rule deleted successfully',
    });
  },
);

alertsRoutes.get(
  '/list',
  requirePermission('analytics_alert:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const status = c.req.query('status') as 'active' | 'acknowledged' | 'resolved' | 'dismissed' | undefined;
    const severity = c.req.query('severity') as 'info' | 'warning' | 'critical' | undefined;
    const metricName = c.req.query('metricName');
    const page = c.req.query('page') ? parseInt(c.req.query('page')!) : 1;
    const pageSize = c.req.query('pageSize') ? parseInt(c.req.query('pageSize')!) : 20;

    const result = await alertEngineService.listAlerts(orgId, {
      status,
      severity,
      metricName,
      page,
      pageSize,
    });

    return c.json({
      success: true,
      data: result.alerts,
      pagination: {
        total: result.total,
        page,
        pageSize,
      },
    });
  },
);

alertsRoutes.get(
  '/:alertId',
  requirePermission('analytics_alert:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const alertId = c.req.param('alertId');

    const alert = await alertEngineService.getAlert(orgId, alertId);

    if (!alert) {
      return c.json({ success: false, error: 'Alert not found' }, 404);
    }

    return c.json({
      success: true,
      data: alert,
    });
  },
);

alertsRoutes.post(
  '/:alertId/acknowledge',
  requirePermission('analytics_alert:acknowledge'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const userId = authCtx.userId;
    const alertId = c.req.param('alertId');

    const alert = await alertEngineService.acknowledgeAlert(orgId, alertId, userId);

    if (!alert) {
      return c.json({ success: false, error: 'Alert not found or already acknowledged' }, 404);
    }

    await auditLog({
      orgId,
      userId,
      action: 'alert.acknowledge',
      entityType: 'alert',
      entityId: alertId,
      changes: JSON.stringify({}),
    });

    return c.json({
      success: true,
      data: alert,
    });
  },
);

alertsRoutes.post(
  '/:alertId/dismiss',
  requirePermission('analytics_alert:dismiss'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const userId = authCtx.userId;
    const alertId = c.req.param('alertId');

    const alert = await alertEngineService.dismissAlert(orgId, alertId);

    if (!alert) {
      return c.json({ success: false, error: 'Alert not found' }, 404);
    }

    await auditLog({
      orgId,
      userId,
      action: 'alert.dismiss',
      entityType: 'alert',
      entityId: alertId,
      changes: JSON.stringify({}),
    });

    return c.json({
      success: true,
      data: alert,
    });
  },
);

alertsRoutes.post(
  '/evaluate',
  requirePermission('analytics:manage'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;

    const newAlerts = await alertEngineService.evaluateRules(orgId);

    return c.json({
      success: true,
      data: {
        evaluated: true,
        newAlerts: newAlerts.length,
        alerts: newAlerts,
      },
    });
  },
);

export { alertsRoutes };
