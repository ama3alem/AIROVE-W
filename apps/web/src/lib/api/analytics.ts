import { api } from './client';

export interface CommandCenterOverview {
  activeBaggage: number;
  openCases: number;
  atRiskBaggage: number;
  criticalCases: number;
  activeRecoveryPlans: number;
  slaCompliance: number;
  transferFailures: number;
  activeAlerts: number;
  airportHealth: Array<{
    airportCode: string;
    airportName: string;
    overallHealth: number;
    transferPerformance: number;
    slaCompliance: number;
    recoveryPerformance: number;
    providerPerformance: number;
    systemReliability: number;
  }>;
}

export interface TrendResult {
  metric: string;
  current: Array<{ timestamp: Date; value: number; label?: string }>;
  previous: Array<{ timestamp: Date; value: number; label?: string }>;
  summary: {
    currentValue: number;
    previousValue: number;
    absoluteChange: number;
    percentageChange: number;
  };
}

export interface CaseAnalyticsSummary {
  totalCases: number;
  openCases: number;
  closedCases: number;
  casesByType: Record<string, number>;
  casesByPriority: Record<string, number>;
  casesByStatus: Record<string, number>;
  averageResolutionMinutes: number | null;
  slaComplianceRate: number;
  agingDistribution: Array<{ label: string; count: number }>;
}

export interface RecoveryAnalyticsSummary {
  totalPlans: number;
  activePlans: number;
  completedPlans: number;
  failedPlans: number;
  averageRecoveryMinutes: number | null;
  slaComplianceRate: number;
  successRate: number;
  plansByType: Record<string, number>;
}

export interface SLAAnalyticsSummary {
  totalEligible: number;
  compliant: number;
  breached: number;
  complianceRate: number;
  byAirport: Record<string, { eligible: number; compliant: number; rate: number }>;
  byProvider: Record<string, { eligible: number; compliant: number; rate: number }>;
}

export interface AnalyticsAlert {
  id: string;
  orgId: string;
  ruleId: string | null;
  ruleName: string;
  metricName: string;
  severity: string;
  status: string;
  actualValue: number;
  threshold: number;
  scopeDimensions: Record<string, string>;
  message: string;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface AnalyticsSavedView {
  id: string;
  userId: string;
  viewName: string;
  description: string | null;
  filters: Record<string, unknown>;
  isDefault: boolean;
  createdAt: Date;
}

export const analyticsApi = {
  getOverview(params?: { timeRange?: string }) {
    return api.get<CommandCenterOverview>('/analytics/overview', params as Record<string, string | number | undefined>);
  },

  getTrend(metric: string, params?: { granularity?: string; timeRange?: string }) {
    return api.get<TrendResult>(`/analytics/trends/${metric}`, params as Record<string, string | number | undefined>);
  },

  getCases(params?: { timeRange?: string }) {
    return api.get<CaseAnalyticsSummary>('/analytics/cases', params as Record<string, string | number | undefined>);
  },

  getRecovery(params?: { timeRange?: string }) {
    return api.get<RecoveryAnalyticsSummary>('/analytics/recovery', params as Record<string, string | number | undefined>);
  },

  getSLA(params?: { timeRange?: string }) {
    return api.get<SLAAnalyticsSummary>('/analytics/sla', params as Record<string, string | number | undefined>);
  },

  getAlerts(params?: { status?: string }) {
    return api.get<AnalyticsAlert[]>('/analytics/alerts', params as Record<string, string | number | undefined>);
  },

  acknowledgeAlert(id: string) {
    return api.post<AnalyticsAlert>(`/analytics/alerts/${id}/acknowledge`);
  },

  resolveAlert(id: string) {
    return api.post<AnalyticsAlert>(`/analytics/alerts/${id}/resolve`);
  },

  getSavedViews() {
    return api.get<AnalyticsSavedView[]>('/analytics/saved-views');
  },
};
