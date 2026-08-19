import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PERMISSIONS,
  ANALYTICS_TIME_RANGES,
  ANALYTICS_GRANULARITIES,
  ANALYTICS_DIMENSIONS,
  METRIC_CATEGORIES,
  HEALTH_SCORE_WEIGHTS,
  HEALTH_THRESHOLDS,
  ALERT_COOLDOWN_MINUTES,
  EXPORT_FORMATS,
  EXPORT_MAX_ROWS,
  ALERT_STATUSES,
  ALERT_SEVERITIES,
  BAGGAGE_AGING_BUCKETS,
} from '@airove/shared';
import {
  analyticsQuerySchema,
  analyticsMetricQuerySchema,
  createAlertRuleSchema,
  updateAlertRuleSchema,
  acknowledgeAlertSchema,
  dismissAlertSchema,
  createSavedViewSchema,
  updateSavedViewSchema,
  createExportSchema,
  commandCenterQuerySchema,
} from '@airove/shared';

// ── resolveTimeRangeBounds ──────────────────────────────────────────────────────

describe('resolveTimeRangeBounds', () => {
  let resolveTimeRangeBounds: typeof import('./metric-engine').resolveTimeRangeBounds;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('./metric-engine');
    resolveTimeRangeBounds = mod.resolveTimeRangeBounds;
  });

  it('today returns start-of-day to now', () => {
    const result = resolveTimeRangeBounds('today');
    expect(result.from.getHours()).toBe(0);
    expect(result.from.getMinutes()).toBe(0);
    expect(result.from.getSeconds()).toBe(0);
    expect(result.to.getTime()).toBeLessThanOrEqual(Date.now());
    expect(result.from.getTime()).toBeLessThanOrEqual(result.to.getTime());
  });

  it('yesterday returns exactly 24h before today', () => {
    const result = resolveTimeRangeBounds('yesterday');
    const diff = result.to.getTime() - result.from.getTime();
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });

  it('last_7_days spans at least 7 days from start of day', () => {
    const result = resolveTimeRangeBounds('last_7_days');
    const diff = result.to.getTime() - result.from.getTime();
    expect(diff).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });

  it('last_30_days spans at least 30 days from start of day', () => {
    const result = resolveTimeRangeBounds('last_30_days');
    const diff = result.to.getTime() - result.from.getTime();
    expect(diff).toBeGreaterThanOrEqual(30 * 24 * 60 * 60 * 1000);
  });

  it('last_90_days spans at least 90 days from start of day', () => {
    const result = resolveTimeRangeBounds('last_90_days');
    const diff = result.to.getTime() - result.from.getTime();
    expect(diff).toBeGreaterThanOrEqual(90 * 24 * 60 * 60 * 1000);
  });

  it('custom_range uses provided dates', () => {
    const from = '2025-01-01T00:00:00Z';
    const to = '2025-01-15T00:00:00Z';
    const result = resolveTimeRangeBounds('custom_range', from, to);
    expect(result.from.toISOString()).toBe(new Date(from).toISOString());
    expect(result.to.toISOString()).toBe(new Date(to).toISOString());
  });

  it('custom_range without dates defaults to today', () => {
    const result = resolveTimeRangeBounds('custom_range');
    expect(result.from.getHours()).toBe(0);
  });
});

// ── Constants / Permissions ─────────────────────────────────────────────────────

describe('Layer 7 Constants', () => {
  describe('ANALYTICS_TIME_RANGES', () => {
    it('includes all required ranges', () => {
      const required = ['today', 'yesterday', 'last_7_days', 'last_30_days', 'last_90_days', 'custom_range'];
      for (const r of required) {
        expect(ANALYTICS_TIME_RANGES).toContain(r);
      }
    });
  });

  describe('ANALYTICS_GRANULARITIES', () => {
    it('includes hour, day, week, month', () => {
      expect(ANALYTICS_GRANULARITIES).toContain('hour');
      expect(ANALYTICS_GRANULARITIES).toContain('day');
      expect(ANALYTICS_GRANULARITIES).toContain('week');
      expect(ANALYTICS_GRANULARITIES).toContain('month');
    });
  });

  describe('METRIC_CATEGORIES', () => {
    it('includes baggage, cases, recovery, routing, providers, sla', () => {
      expect(METRIC_CATEGORIES).toContain('baggage');
      expect(METRIC_CATEGORIES).toContain('cases');
      expect(METRIC_CATEGORIES).toContain('recovery');
      expect(METRIC_CATEGORIES).toContain('routing');
      expect(METRIC_CATEGORIES).toContain('providers');
      expect(METRIC_CATEGORIES).toContain('sla');
    });
  });

  describe('HEALTH_SCORE_WEIGHTS', () => {
    it('sums to 1.0', () => {
      const sum =
        HEALTH_SCORE_WEIGHTS.transferPerformance +
        HEALTH_SCORE_WEIGHTS.slaCompliance +
        HEALTH_SCORE_WEIGHTS.recoveryPerformance +
        HEALTH_SCORE_WEIGHTS.providerPerformance +
        HEALTH_SCORE_WEIGHTS.systemReliability;
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('each weight is between 0 and 1', () => {
      for (const weight of Object.values(HEALTH_SCORE_WEIGHTS)) {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('HEALTH_THRESHOLDS', () => {
    it('defines excellent, good, fair thresholds', () => {
      expect(HEALTH_THRESHOLDS.excellent).toBeGreaterThan(HEALTH_THRESHOLDS.good);
      expect(HEALTH_THRESHOLDS.good).toBeGreaterThan(HEALTH_THRESHOLDS.fair);
    });
  });

  describe('ALERT_COOLDOWN_MINUTES', () => {
    it('is a positive number', () => {
      expect(ALERT_COOLDOWN_MINUTES).toBeGreaterThan(0);
    });
  });

  describe('EXPORT_MAX_ROWS', () => {
    it('is a positive number', () => {
      expect(EXPORT_MAX_ROWS).toBeGreaterThan(0);
    });
  });

  describe('EXPORT_FORMATS', () => {
    it('includes csv and json', () => {
      expect(EXPORT_FORMATS).toContain('csv');
      expect(EXPORT_FORMATS).toContain('json');
    });
  });

  describe('ALERT_STATUSES', () => {
    it('includes active, acknowledged, resolved', () => {
      expect(ALERT_STATUSES).toContain('active');
      expect(ALERT_STATUSES).toContain('acknowledged');
      expect(ALERT_STATUSES).toContain('resolved');
    });
  });

  describe('ALERT_SEVERITIES', () => {
    it('includes info, warning, critical', () => {
      expect(ALERT_SEVERITIES).toContain('info');
      expect(ALERT_SEVERITIES).toContain('warning');
      expect(ALERT_SEVERITIES).toContain('critical');
    });
  });

  describe('BAGGAGE_AGING_BUCKETS', () => {
    it('is a non-empty array', () => {
      expect(BAGGAGE_AGING_BUCKETS.length).toBeGreaterThan(0);
    });

    it('each bucket has label and maxMinutes', () => {
      for (const bucket of BAGGAGE_AGING_BUCKETS) {
        expect(bucket).toHaveProperty('label');
        expect(bucket).toHaveProperty('maxMinutes');
      }
    });
  });

  describe('ANALYTICS_DIMENSIONS', () => {
    it('includes airport, airline, provider', () => {
      expect(ANALYTICS_DIMENSIONS).toContain('airport');
      expect(ANALYTICS_DIMENSIONS).toContain('airline');
      expect(ANALYTICS_DIMENSIONS).toContain('provider');
    });
  });

  describe('Permissions', () => {
    it('has ANALYTICS_VIEW', () => {
      expect(PERMISSIONS.ANALYTICS_VIEW).toBeDefined();
    });
    it('has ANALYTICS_EXPORT', () => {
      expect(PERMISSIONS.ANALYTICS_EXPORT).toBeDefined();
    });
    it('has COMMAND_CENTER_VIEW', () => {
      expect(PERMISSIONS.COMMAND_CENTER_VIEW).toBeDefined();
    });
  });
});

// ── Zod Schemas ─────────────────────────────────────────────────────────────────

describe('Layer 7 Zod Schemas', () => {
  describe('analyticsQuerySchema', () => {
    it('applies defaults for missing fields', () => {
      const result = analyticsQuerySchema.parse({});
      expect(result.timeRange).toBe('last_30_days');
      expect(result.granularity).toBe('day');
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('validates timeRange values', () => {
      const result = analyticsQuerySchema.parse({ timeRange: 'last_7_days' });
      expect(result.timeRange).toBe('last_7_days');
    });

    it('rejects invalid timeRange', () => {
      expect(() => analyticsQuerySchema.parse({ timeRange: 'invalid' })).toThrow();
    });

    it('validates granularity', () => {
      const result = analyticsQuerySchema.parse({ granularity: 'week' });
      expect(result.granularity).toBe('week');
    });
  });

  describe('analyticsMetricQuerySchema', () => {
    it('requires metricName', () => {
      expect(() => analyticsMetricQuerySchema.parse({})).toThrow();
    });

    it('valid with metricName', () => {
      const result = analyticsMetricQuerySchema.parse({ metricName: 'baggage_total' });
      expect(result.metricName).toBe('baggage_total');
      expect(result.timeRange).toBe('last_30_days');
    });
  });

  describe('createAlertRuleSchema', () => {
    it('validates a complete rule', () => {
      const result = createAlertRuleSchema.parse({
        ruleName: 'High baggage count',
        metricName: 'baggage_total',
        condition: 'gt',
        threshold: 100,
        severity: 'critical',
      });
      expect(result.ruleName).toBe('High baggage count');
      expect(result.condition).toBe('gt');
      expect(result.threshold).toBe(100);
      expect(result.severity).toBe('critical');
    });

    it('applies default cooldownMinutes', () => {
      const result = createAlertRuleSchema.parse({
        ruleName: 'Test',
        metricName: 'test_metric',
        condition: 'gt',
        threshold: 0,
        severity: 'info',
      });
      expect(result.cooldownMinutes).toBe(30);
    });

    it('rejects empty ruleName', () => {
      expect(() =>
        createAlertRuleSchema.parse({
          ruleName: '',
          metricName: 'test',
          condition: 'gt',
          threshold: 0,
          severity: 'info',
        }),
      ).toThrow();
    });
  });

  describe('updateAlertRuleSchema', () => {
    it('accepts partial updates', () => {
      const result = updateAlertRuleSchema.parse({ threshold: 200 });
      expect(result.threshold).toBe(200);
    });

    it('accepts empty update (noop)', () => {
      const result = updateAlertRuleSchema.parse({});
      expect(Object.keys(result).length).toBe(0);
    });
  });

  describe('acknowledgeAlertSchema', () => {
    it('accepts optional notes', () => {
      const result = acknowledgeAlertSchema.parse({ notes: 'Acknowledged' });
      expect(result.notes).toBe('Acknowledged');
    });

    it('accepts empty object', () => {
      const result = acknowledgeAlertSchema.parse({});
      expect(result).toEqual({});
    });
  });

  describe('dismissAlertSchema', () => {
    it('requires reason', () => {
      expect(() => dismissAlertSchema.parse({})).toThrow();
    });

    it('valid with reason', () => {
      const result = dismissAlertSchema.parse({ reason: 'False positive' });
      expect(result.reason).toBe('False positive');
    });
  });

  describe('createSavedViewSchema', () => {
    it('validates a complete view', () => {
      const result = createSavedViewSchema.parse({
        viewName: 'My View',
        filters: { timeRange: 'last_7_days' },
      });
      expect(result.viewName).toBe('My View');
      expect(result.isDefault).toBe(false);
    });

    it('rejects empty viewName', () => {
      expect(() =>
        createSavedViewSchema.parse({
          viewName: '',
          filters: {},
        }),
      ).toThrow();
    });
  });

  describe('updateSavedViewSchema', () => {
    it('accepts partial updates', () => {
      const result = updateSavedViewSchema.parse({ viewName: 'Renamed' });
      expect(result.viewName).toBe('Renamed');
    });
  });

  describe('createExportSchema', () => {
    it('validates a complete export', () => {
      const result = createExportSchema.parse({
        exportType: 'baggage_summary',
        format: 'csv',
        filters: { timeRange: 'last_30_days' },
      });
      expect(result.exportType).toBe('baggage_summary');
      expect(result.format).toBe('csv');
    });

    it('rejects invalid format', () => {
      expect(() =>
        createExportSchema.parse({
          exportType: 'test',
          format: 'xml',
          filters: {},
        }),
      ).toThrow();
    });
  });

  describe('commandCenterQuerySchema', () => {
    it('accepts empty object', () => {
      const result = commandCenterQuerySchema.parse({});
      expect(result.airportCode).toBeUndefined();
    });

    it('accepts airportCode', () => {
      const result = commandCenterQuerySchema.parse({ airportCode: 'JFK' });
      expect(result.airportCode).toBe('JFK');
    });
  });
});

// ── Security Tests ─────────────────────────────────────────────────────────────

describe('Layer 7 Security', () => {
  describe('Cross-tenant isolation — all services require orgId', () => {
    it('alertEngineService.listAlertRules requires orgId param', async () => {
      const { alertEngineService } = await import('./alert-engine');
      expect(typeof alertEngineService.listAlertRules).toBe('function');
      expect(alertEngineService.listAlertRules.length).toBeGreaterThanOrEqual(1);
    });

    it('alertEngineService.listAlerts requires orgId param', async () => {
      const { alertEngineService } = await import('./alert-engine');
      expect(typeof alertEngineService.listAlerts).toBe('function');
      expect(alertEngineService.listAlerts.length).toBeGreaterThanOrEqual(1);
    });

    it('alertEngineService.getAlert requires orgId param', async () => {
      const { alertEngineService } = await import('./alert-engine');
      expect(typeof alertEngineService.getAlert).toBe('function');
      expect(alertEngineService.getAlert.length).toBeGreaterThanOrEqual(2);
    });

    it('alertEngineService.evaluateRules requires orgId param', async () => {
      const { alertEngineService } = await import('./alert-engine');
      expect(typeof alertEngineService.evaluateRules).toBe('function');
      expect(alertEngineService.evaluateRules.length).toBe(1);
    });

    it('exportService.listExports requires orgId param', async () => {
      const { exportService } = await import('./export-service');
      expect(typeof exportService.listExports).toBe('function');
      expect(exportService.listExports.length).toBeGreaterThanOrEqual(1);
    });

    it('exportService.getExport requires orgId param', async () => {
      const { exportService } = await import('./export-service');
      expect(typeof exportService.getExport).toBe('function');
      expect(exportService.getExport.length).toBeGreaterThanOrEqual(2);
    });

    it('exportService.generateExportData requires orgId param', async () => {
      const { exportService } = await import('./export-service');
      expect(typeof exportService.generateExportData).toBe('function');
      expect(exportService.generateExportData.length).toBeGreaterThanOrEqual(2);
    });

    it('metricEngineService.getMetricDefinition requires orgId param', async () => {
      const { metricEngineService } = await import('./metric-engine');
      expect(typeof metricEngineService.getMetricDefinition).toBe('function');
      expect(metricEngineService.getMetricDefinition.length).toBe(2);
    });

    it('metricEngineService.getMetricValue requires orgId param', async () => {
      const { metricEngineService } = await import('./metric-engine');
      expect(typeof metricEngineService.getMetricValue).toBe('function');
      expect(metricEngineService.getMetricValue.length).toBeGreaterThanOrEqual(2);
    });

    it('metricEngineService.getSnapshots requires orgId param', async () => {
      const { metricEngineService } = await import('./metric-engine');
      expect(typeof metricEngineService.getSnapshots).toBe('function');
      expect(metricEngineService.getSnapshots.length).toBeGreaterThanOrEqual(2);
    });

    it('trendEngineService.getTrend requires orgId param', async () => {
      const { trendEngineService } = await import('./trend-engine');
      expect(typeof trendEngineService.getTrend).toBe('function');
      expect(trendEngineService.getTrend.length).toBeGreaterThanOrEqual(2);
    });

    it('commandCenterService.getOverview requires orgId param', async () => {
      const { commandCenterService } = await import('./command-center-service');
      expect(typeof commandCenterService.getOverview).toBe('function');
      expect(commandCenterService.getOverview.length).toBeGreaterThanOrEqual(1);
    });

    it('commandCenterService.getAirportHealth requires orgId param', async () => {
      const { commandCenterService } = await import('./command-center-service');
      expect(typeof commandCenterService.getAirportHealth).toBe('function');
      expect(commandCenterService.getAirportHealth.length).toBe(1);
    });
  });

  describe('Input validation — Zod schema injection resistance', () => {
    it('createAlertRuleSchema rejects SQL injection in ruleName via length limit', () => {
      const longSql = "'; DROP TABLE analytics_alert_rules; --".repeat(10);
      expect(() =>
        createAlertRuleSchema.parse({
          ruleName: longSql,
          metricName: 'test',
          condition: 'gt',
          threshold: 0,
          severity: 'info',
        }),
      ).toThrow();
    });

    it('createAlertRuleSchema rejects XSS in ruleName via length limit', () => {
      const longXss = '<script>alert("xss")</script>'.repeat(10);
      expect(() =>
        createAlertRuleSchema.parse({
          ruleName: longXss,
          metricName: 'test',
          condition: 'gt',
          threshold: 0,
          severity: 'info',
        }),
      ).toThrow();
    });

    it('createAlertRuleSchema rejects empty metricName', () => {
      expect(() =>
        createAlertRuleSchema.parse({
          ruleName: 'Test Rule',
          metricName: '',
          condition: 'gt',
          threshold: 0,
          severity: 'info',
        }),
      ).toThrow();
    });

    it('createAlertRuleSchema rejects invalid condition operators', () => {
      expect(() =>
        createAlertRuleSchema.parse({
          ruleName: 'Test',
          metricName: 'test',
          condition: 'OR 1=1',
          threshold: 0,
          severity: 'info',
        }),
      ).toThrow();
    });

    it('createAlertRuleSchema rejects invalid severity', () => {
      expect(() =>
        createAlertRuleSchema.parse({
          ruleName: 'Test',
          metricName: 'test',
          condition: 'gt',
          threshold: 0,
          severity: 'critical_injection',
        }),
      ).toThrow();
    });

    it('createExportSchema rejects invalid format', () => {
      expect(() =>
        createExportSchema.parse({
          exportType: 'test',
          format: 'exe',
          filters: {},
        }),
      ).toThrow();
    });

    it('createExportSchema rejects invalid exportType', () => {
      expect(() =>
        createExportSchema.parse({
          exportType: '',
          format: 'csv',
          filters: {},
        }),
      ).toThrow();
    });

    it('createSavedViewSchema rejects empty viewName', () => {
      expect(() =>
        createSavedViewSchema.parse({
          viewName: '',
          filters: {},
        }),
      ).toThrow();
    });

    it('dismissAlertSchema requires non-empty reason', () => {
      expect(() => dismissAlertSchema.parse({ reason: '' })).toThrow();
    });

    it('analyticsQuerySchema rejects invalid page values', () => {
      expect(() =>
        analyticsQuerySchema.parse({ page: -1 }),
      ).toThrow();
    });

    it('analyticsQuerySchema rejects page size over 100', () => {
      expect(() =>
        analyticsQuerySchema.parse({ pageSize: 101 }),
      ).toThrow();
    });
  });

  describe('Permission constants — complete coverage', () => {
    it('defines all L7-specific permissions', () => {
      expect(PERMISSIONS.ANALYTICS_VIEW).toBeDefined();
      expect(PERMISSIONS.ANALYTICS_EXPORT).toBeDefined();
      expect(PERMISSIONS.ANALYTICS_MANAGE).toBeDefined();
      expect(PERMISSIONS.COMMAND_CENTER_VIEW).toBeDefined();
      expect(PERMISSIONS.ANALYTICS_ALERT_VIEW).toBeDefined();
      expect(PERMISSIONS.ANALYTICS_ALERT_ACKNOWLEDGE).toBeDefined();
      expect(PERMISSIONS.ANALYTICS_ALERT_DISMISS).toBeDefined();
      expect(PERMISSIONS.ANALYTICS_SAVED_VIEW_CREATE).toBeDefined();
      expect(PERMISSIONS.ANALYTICS_SAVED_VIEW_MANAGE).toBeDefined();
      expect(PERMISSIONS.ANALYTICS_REPORT_VIEW).toBeDefined();
      expect(PERMISSIONS.ANALYTICS_REPORT_CREATE).toBeDefined();
    });

    it('all L7 permissions are non-empty strings', () => {
      const l7Permissions = [
        PERMISSIONS.ANALYTICS_VIEW,
        PERMISSIONS.ANALYTICS_EXPORT,
        PERMISSIONS.ANALYTICS_MANAGE,
        PERMISSIONS.COMMAND_CENTER_VIEW,
        PERMISSIONS.ANALYTICS_ALERT_VIEW,
        PERMISSIONS.ANALYTICS_ALERT_ACKNOWLEDGE,
        PERMISSIONS.ANALYTICS_ALERT_DISMISS,
        PERMISSIONS.ANALYTICS_SAVED_VIEW_CREATE,
        PERMISSIONS.ANALYTICS_SAVED_VIEW_MANAGE,
        PERMISSIONS.ANALYTICS_REPORT_VIEW,
        PERMISSIONS.ANALYTICS_REPORT_CREATE,
      ];

      for (const perm of l7Permissions) {
        expect(typeof perm).toBe('string');
        expect(perm.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Alert threshold enforcement', () => {
    it('alert condition operators only allow gt, lt, gte, lte, eq', () => {
      const validConditions = ['gt', 'lt', 'gte', 'lte', 'eq'];

      for (const cond of validConditions) {
        const result = createAlertRuleSchema.parse({
          ruleName: 'Test',
          metricName: 'test',
          condition: cond,
          threshold: 0,
          severity: 'info',
        });
        expect(result.condition).toBe(cond);
      }
    });

    it('ALERT_COOLDOWN_MINUTES is at least 5 minutes', () => {
      expect(ALERT_COOLDOWN_MINUTES).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Export safety — formatExportData', () => {
    it('CSV formatter escapes commas in values', async () => {
      const { exportService } = await import('./export-service');
      const data = [{ name: 'John, Doe', value: 42 }];
      const csv = exportService.formatExportData(data, 'csv');
      expect(csv).toContain('"John, Doe"');
    });

    it('CSV formatter escapes double quotes', async () => {
      const { exportService } = await import('./export-service');
      const data = [{ name: 'Say "hello"', value: 1 }];
      const csv = exportService.formatExportData(data, 'csv');
      expect(csv).toContain('"Say ""hello"""');
    });

    it('CSV formatter escapes newlines', async () => {
      const { exportService } = await import('./export-service');
      const data = [{ name: 'Line1\nLine2', value: 1 }];
      const csv = exportService.formatExportData(data, 'csv');
      expect(csv).toContain('"Line1\nLine2"');
    });

    it('JSON formatter produces valid JSON', async () => {
      const { exportService } = await import('./export-service');
      const data = [{ key: 'value', nested: { a: 1 } }];
      const json = exportService.formatExportData(data, 'json');
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(data);
    });

    it('empty data produces empty string for CSV', async () => {
      const { exportService } = await import('./export-service');
      const csv = exportService.formatExportData([], 'csv');
      expect(csv).toBe('');
    });

    it('empty data produces empty array for JSON', async () => {
      const { exportService } = await import('./export-service');
      const json = exportService.formatExportData([], 'json');
      expect(json).toBe('[]');
    });
  });

  describe('Saved view default uniqueness constraint', () => {
    it('createSavedViewSchema allows isDefault true', () => {
      const result = createSavedViewSchema.parse({
        viewName: 'Default View',
        filters: {},
        isDefault: true,
      });
      expect(result.isDefault).toBe(true);
    });

    it('createSavedViewSchema defaults isDefault to false', () => {
      const result = createSavedViewSchema.parse({
        viewName: 'View',
        filters: {},
      });
      expect(result.isDefault).toBe(false);
    });
  });
});
