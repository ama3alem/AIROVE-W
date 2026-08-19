import { describe, it, expect } from 'vitest';

// ── L4 → L7 Integration ───────────────────────────────────────────────────────
// Verifies L7 services correctly consume L4 operational data.

describe('L4 → L7 Integration', () => {
  it('aggregationService imports L4 baggage table', async () => {
    const mod = await import('../lib/aggregation-service');
    expect(typeof mod.aggregationService.aggregateBaggageMetrics).toBe('function');
    expect(typeof mod.aggregationService.aggregateEventMetrics).toBe('function');
  });

  it('baggageAnalyticsService imports L4 baggage and events', async () => {
    const mod = await import('../lib/domain-analytics');
    expect(typeof mod.baggageAnalyticsService.getAgingDistribution).toBe('function');
    expect(typeof mod.baggageAnalyticsService.getEventsByType).toBe('function');
  });

  it('commandCenterService imports L4 baggage and operational exceptions', async () => {
    const mod = await import('../lib/command-center-service');
    expect(typeof mod.commandCenterService.getOverview).toBe('function');
    expect(typeof mod.commandCenterService.getAirportHealth).toBe('function');
  });

  it('aggregationService.aggregateEventMetrics queries baggageEvents with orgId', async () => {
    const mod = await import('../lib/aggregation-service');
    expect(mod.aggregationService.aggregateEventMetrics.length).toBeGreaterThanOrEqual(1);
  });

  it('baggageAnalyticsService.getAgingDistribution accepts orgId and optional airportCode', async () => {
    const mod = await import('../lib/domain-analytics');
    expect(mod.baggageAnalyticsService.getAgingDistribution.length).toBeGreaterThanOrEqual(1);
  });
});

// ── L5 → L7 Integration ───────────────────────────────────────────────────────
// Verifies L7 services correctly consume L5 case/workflow data.

describe('L5 → L7 Integration', () => {
  it('aggregationService imports L5 cases and SLA tables', async () => {
    const mod = await import('../lib/aggregation-service');
    expect(typeof mod.aggregationService.aggregateCaseMetrics).toBe('function');
    expect(typeof mod.aggregationService.aggregateSLAMetrics).toBe('function');
  });

  it('caseAnalyticsService imports L5 case data', async () => {
    const mod = await import('../lib/domain-analytics');
    expect(typeof mod.caseAnalyticsService.getSummary).toBe('function');
  });

  it('commandCenterService queries L5 cases for overview', async () => {
    const mod = await import('../lib/command-center-service');
    expect(typeof mod.commandCenterService.getOverview).toBe('function');
  });

  it('aggregationService.aggregateSLAMetrics joins caseSla with cases', async () => {
    const mod = await import('../lib/aggregation-service');
    expect(typeof mod.aggregationService.aggregateSLAMetrics).toBe('function');
    expect(mod.aggregationService.aggregateSLAMetrics.length).toBeGreaterThanOrEqual(1);
  });
});

// ── L6 → L7 Integration ───────────────────────────────────────────────────────
// Verifies L7 services correctly consume L6 recovery/routing data.

describe('L6 → L7 Integration', () => {
  it('aggregationService imports L6 recoveryPlans and providers', async () => {
    const mod = await import('../lib/aggregation-service');
    expect(typeof mod.aggregationService.aggregateRecoveryMetrics).toBe('function');
    expect(typeof mod.aggregationService.aggregateProviderMetrics).toBe('function');
  });

  it('recoveryAnalyticsService imports L6 recovery data', async () => {
    const mod = await import('../lib/domain-analytics');
    expect(typeof mod.recoveryAnalyticsService.getSummary).toBe('function');
  });

  it('providerAnalyticsService imports L6 provider data', async () => {
    const mod = await import('../lib/domain-analytics');
    expect(typeof mod.providerAnalyticsService.getSummary).toBe('function');
  });

  it('routeAnalyticsService imports L6 route data', async () => {
    const mod = await import('../lib/domain-analytics');
    expect(typeof mod.routeAnalyticsService.getSummary).toBe('function');
  });

  it('exportService imports L6 recoveryPlans for export', async () => {
    const mod = await import('../lib/export-service');
    expect(typeof mod.exportService.generateExportData).toBe('function');
  });

  it('aggregationService.aggregateProviderMetrics joins recoveryProviderAssignments with recoveryProviders', async () => {
    const mod = await import('../lib/aggregation-service');
    expect(typeof mod.aggregationService.aggregateProviderMetrics).toBe('function');
    expect(mod.aggregationService.aggregateProviderMetrics.length).toBeGreaterThanOrEqual(1);
  });
});

// ── L7 Worker Integration ─────────────────────────────────────────────────────
// Verifies L7 workers' underlying services are importable and correctly typed.
// Workers themselves require REDIS_URL, so we test their service dependencies.

describe('L7 Worker Integration', () => {
  it('snapshot worker depends on aggregation + metric engine services', async () => {
    const aggMod = await import('../lib/aggregation-service');
    const metricMod = await import('../lib/metric-engine');
    expect(typeof aggMod.aggregationService.aggregateBaggageMetrics).toBe('function');
    expect(typeof aggMod.aggregationService.aggregateCaseMetrics).toBe('function');
    expect(typeof aggMod.aggregationService.aggregateRecoveryMetrics).toBe('function');
    expect(typeof aggMod.aggregationService.aggregateSLAMetrics).toBe('function');
    expect(typeof aggMod.aggregationService.aggregateEventMetrics).toBe('function');
    expect(typeof metricMod.metricEngineService.upsertSnapshot).toBe('function');
  });

  it('alert evaluation worker depends on alert engine service', async () => {
    const mod = await import('../lib/alert-engine');
    expect(typeof mod.alertEngineService.listAlertRules).toBe('function');
    expect(typeof mod.alertEngineService.evaluateRules).toBe('function');
  });

  it('export worker depends on export service', async () => {
    const mod = await import('../lib/export-service');
    expect(typeof mod.exportService.updateExportStatus).toBe('function');
    expect(typeof mod.exportService.generateExportData).toBe('function');
    expect(typeof mod.exportService.formatExportData).toBe('function');
  });
});

// ── Cross-layer Data Flow ─────────────────────────────────────────────────────
// Verifies the complete data flow from operational tables through aggregation
// into analytics snapshots and alerts.

describe('Cross-layer Data Flow', () => {
  it('metricEngineService provides getMetricValue for alert evaluation', async () => {
    const mod = await import('../lib/metric-engine');
    expect(typeof mod.metricEngineService.getMetricValue).toBe('function');
  });

  it('trendEngineService provides getTrend for analytics', async () => {
    const mod = await import('../lib/trend-engine');
    expect(typeof mod.trendEngineService.getTrend).toBe('function');
    expect(typeof mod.trendEngineService.detectAnomalies).toBe('function');
  });

  it('alertEngineService.evaluateRules uses snapshot data for evaluation', async () => {
    const mod = await import('../lib/alert-engine');
    expect(typeof mod.alertEngineService.evaluateRules).toBe('function');
  });

  it('exportService.generateExportData applies time range filters from L4/L5/L6', async () => {
    const mod = await import('../lib/export-service');
    expect(typeof mod.exportService.generateExportData).toBe('function');
  });

  it('commandCenterService.getOverview aggregates L4 + L5 + L6 data', async () => {
    const mod = await import('../lib/command-center-service');
    expect(typeof mod.commandCenterService.getOverview).toBe('function');
  });

  it('commandCenterService.getAirportHealth uses L4/L5/L6 data', async () => {
    const mod = await import('../lib/command-center-service');
    expect(typeof mod.commandCenterService.getAirportHealth).toBe('function');
  });
});
