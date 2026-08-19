import { Hono } from 'hono';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import type { AppEnv } from '../types/env.js';
import {
  metricEngineService,
  resolveTimeRangeBounds,
} from '../lib/metric-engine.js';
import { aggregationService } from '../lib/aggregation-service.js';
import { trendEngineService } from '../lib/trend-engine.js';
import {
  baggageAnalyticsService,
  caseAnalyticsService,
  recoveryAnalyticsService,
  routeAnalyticsService,
  providerAnalyticsService,
} from '../lib/domain-analytics.js';
import type { AnalyticsTimeRange, AnalyticsGranularity } from '@airove/shared';

const analyticsRoutes = new Hono<AppEnv>();

analyticsRoutes.use('*', authMiddleware);

analyticsRoutes.get(
  '/overview',
  requirePermission('analytics:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const query = c.req.query();
    const timeRange = (query['timeRange'] ?? 'last_30_days') as AnalyticsTimeRange;
    const granularity = (query['granularity'] ?? 'day') as AnalyticsGranularity;
    const customFrom = query['customFrom'];
    const customTo = query['customTo'];

    const [baggageMetrics, caseMetrics, recoveryMetrics, providerMetrics] = await Promise.all([
      aggregationService.aggregateBaggageMetrics(orgId, timeRange, undefined, customFrom, customTo),
      aggregationService.aggregateCaseMetrics(orgId, timeRange, undefined, customFrom, customTo),
      aggregationService.aggregateRecoveryMetrics(orgId, timeRange, undefined, customFrom, customTo),
      aggregationService.aggregateProviderMetrics(orgId, timeRange, customFrom, customTo),
    ]);

    return c.json({
      success: true,
      data: {
        baggage: baggageMetrics,
        cases: caseMetrics,
        recovery: recoveryMetrics,
        providers: providerMetrics,
        timeRange,
        granularity,
      },
    });
  },
);

analyticsRoutes.get(
  '/metrics',
  requirePermission('analytics:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const category = c.req.query('category');

    const definitions = await metricEngineService.listMetricDefinitions(orgId, category);

    return c.json({
      success: true,
      data: definitions,
    });
  },
);

analyticsRoutes.get(
  '/metrics/:metricName',
  requirePermission('analytics:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const metricName = c.req.param('metricName');
    const query = c.req.query();
    const timeRange = (query['timeRange'] ?? 'last_30_days') as AnalyticsTimeRange;
    const customFrom = query['customFrom'];
    const customTo = query['customTo'];

    const value = await metricEngineService.getMetricValue(
      orgId,
      metricName,
      timeRange,
      {},
      customFrom,
      customTo,
    );

    if (!value) {
      return c.json({ success: false, error: 'Metric not found' }, 404);
    }

    return c.json({
      success: true,
      data: value,
    });
  },
);

analyticsRoutes.get(
  '/metrics/:metricName/trend',
  requirePermission('analytics:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const metricName = c.req.param('metricName');
    const query = c.req.query();
    const timeRange = (query['timeRange'] ?? 'last_30_days') as AnalyticsTimeRange;
    const granularity = (query['granularity'] ?? 'day') as AnalyticsGranularity;
    const customFrom = query['customFrom'];
    const customTo = query['customTo'];

    const trend = await trendEngineService.getTrend(
      orgId,
      metricName,
      timeRange,
      granularity,
      customFrom,
      customTo,
    );

    return c.json({
      success: true,
      data: trend,
    });
  },
);

analyticsRoutes.get(
  '/metrics/:metricName/anomalies',
  requirePermission('analytics:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const metricName = c.req.param('metricName');
    const query = c.req.query();
    const timeRange = (query['timeRange'] ?? 'last_30_days') as AnalyticsTimeRange;
    const granularity = (query['granularity'] ?? 'day') as AnalyticsGranularity;
    const customFrom = query['customFrom'];
    const customTo = query['customTo'];

    const anomalies = await trendEngineService.detectAnomalies(
      orgId,
      metricName,
      timeRange,
      granularity,
      customFrom,
      customTo,
    );

    return c.json({
      success: true,
      data: anomalies,
    });
  },
);

analyticsRoutes.get(
  '/baggage/aging',
  requirePermission('analytics:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const airportCode = c.req.query('airportCode');

    const distribution = await baggageAnalyticsService.getAgingDistribution(
      orgId,
      airportCode,
    );

    return c.json({
      success: true,
      data: distribution,
    });
  },
);

analyticsRoutes.get(
  '/baggage/events',
  requirePermission('analytics:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const query = c.req.query();
    const timeRange = (query['timeRange'] ?? 'last_30_days') as AnalyticsTimeRange;
    const customFrom = query['customFrom'];
    const customTo = query['customTo'];

    const events = await baggageAnalyticsService.getEventsByType(
      orgId,
      timeRange,
      customFrom,
      customTo,
    );

    return c.json({
      success: true,
      data: events,
    });
  },
);

analyticsRoutes.get(
  '/cases',
  requirePermission('analytics:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const query = c.req.query();
    const timeRange = (query['timeRange'] ?? 'last_30_days') as AnalyticsTimeRange;
    const customFrom = query['customFrom'];
    const customTo = query['customTo'];

    const summary = await caseAnalyticsService.getSummary(
      orgId,
      timeRange,
      undefined,
      customFrom,
      customTo,
    );

    return c.json({
      success: true,
      data: summary,
    });
  },
);

analyticsRoutes.get(
  '/recovery',
  requirePermission('analytics:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const query = c.req.query();
    const timeRange = (query['timeRange'] ?? 'last_30_days') as AnalyticsTimeRange;
    const customFrom = query['customFrom'];
    const customTo = query['customTo'];

    const summary = await recoveryAnalyticsService.getSummary(
      orgId,
      timeRange,
      undefined,
      customFrom,
      customTo,
    );

    return c.json({
      success: true,
      data: summary,
    });
  },
);

analyticsRoutes.get(
  '/routes',
  requirePermission('analytics:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const query = c.req.query();
    const timeRange = (query['timeRange'] ?? 'last_30_days') as AnalyticsTimeRange;
    const customFrom = query['customFrom'];
    const customTo = query['customTo'];

    const summary = await routeAnalyticsService.getSummary(
      orgId,
      timeRange,
      customFrom,
      customTo,
    );

    return c.json({
      success: true,
      data: summary,
    });
  },
);

analyticsRoutes.get(
  '/providers',
  requirePermission('analytics:view'),
  async (c) => {
    const authCtx = c.get('auth');
    const orgId = authCtx.orgId;
    const query = c.req.query();
    const timeRange = (query['timeRange'] ?? 'last_30_days') as AnalyticsTimeRange;
    const customFrom = query['customFrom'];
    const customTo = query['customTo'];

    const summary = await providerAnalyticsService.getSummary(
      orgId,
      timeRange,
      customFrom,
      customTo,
    );

    return c.json({
      success: true,
      data: summary,
    });
  },
);

export { analyticsRoutes };
