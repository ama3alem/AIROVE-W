'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { analyticsApi } from '@/lib/api/analytics';
import { PageHeader, StatCard, Card, CardHeader, CardTitle, CardBody, Badge } from '@/components/ui';
import { LoadingSpinner, ErrorState, formatPercent } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

type TimeRange = 'today' | 'last_7_days' | 'last_30_days';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  today: 'Today',
  last_7_days: 'Last 7 Days',
  last_30_days: 'Last 30 Days',
};

const BRAND_COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
};

interface ChartDataItem {
  name: string;
  value: number;
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('last_7_days');
  const params = { timeRange };

  const { data: overview, loading: overviewLoading, error: overviewError, refetch: refetchOverview } = useApi(() => analyticsApi.getOverview(params), [timeRange]);
  const { data: cases, loading: casesLoading, error: casesError, refetch: refetchCases } = useApi(() => analyticsApi.getCases(params), [timeRange]);
  const { data: recovery, loading: recoveryLoading, error: recoveryError, refetch: refetchRecovery } = useApi(() => analyticsApi.getRecovery(params), [timeRange]);
  const { data: sla, loading: slaLoading, error: slaError, refetch: refetchSla } = useApi(() => analyticsApi.getSLA(params), [timeRange]);

  const loading = overviewLoading || casesLoading || recoveryLoading || slaLoading;
  const error = overviewError || casesError || recoveryError || slaError;
  const refetchAll = () => { refetchOverview(); refetchCases(); refetchRecovery(); refetchSla(); };

  const caseDistributionData: ChartDataItem[] = cases?.casesByType
    ? Object.entries(cases.casesByType).map(([name, value]) => ({ name, value: value as number }))
    : [];

  const recoveryStatusData: ChartDataItem[] = recovery
    ? [
        { name: 'Completed', value: recovery.completedPlans },
        { name: 'Active', value: recovery.activePlans },
        { name: 'Failed', value: recovery.failedPlans },
      ].filter((item) => item.value > 0)
    : [];

  const slaComplianceData: ChartDataItem[] = sla
    ? [
        { name: 'Compliant', value: sla.compliant },
        { name: 'Breached', value: sla.breached },
      ].filter((item) => item.value > 0)
    : [];

  const hasCaseData = caseDistributionData.length > 0;
  const hasRecoveryData = recoveryStatusData.length > 0;
  const hasSlaData = slaComplianceData.length > 0;

  return (
    <div className="page-container">
      <PageHeader
        breadcrumbs={[{ label: 'Analytics', href: '/analytics' }, { label: 'Overview' }]}
        title="Operational Analytics & Intelligence"
        subtitle="Layer 7 Aggregate Analytics & Cross-Operational Trends"
        actions={
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="select w-44 text-xs"
          >
            {Object.entries(TIME_RANGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        }
      />

      {loading ? <LoadingSpinner /> : error ? <ErrorState message={error} onRetry={refetchAll} /> : (
        <div className="space-y-6">
          {overview && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Active Baggage" value={overview.activeBaggage} icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" /></svg>} />
              <StatCard label="Open Cases" value={overview.openCases} icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>} />
              <StatCard label="At-Risk Baggage" value={overview.atRiskBaggage} icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>} />
              <StatCard label="Critical Cases" value={overview.criticalCases} icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>} />
              <StatCard label="Active Recovery Plans" value={overview.activeRecoveryPlans} icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>} />
              <StatCard label="SLA Compliance" value={formatPercent(overview.slaCompliance)} icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
              <StatCard label="Transfer Failures" value={overview.transferFailures} icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>} />
              <StatCard label="Active Alerts" value={overview.activeAlerts} icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Case Distribution</CardTitle>
              </CardHeader>
              <CardBody>
                {hasCaseData ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={caseDistributionData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill={BRAND_COLORS.primary} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[250px] items-center justify-center text-sm text-gray-400">
                    No data available
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recovery Success</CardTitle>
              </CardHeader>
              <CardBody>
                {hasRecoveryData ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={recoveryStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {recoveryStatusData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={
                              entry.name === 'Completed'
                                ? BRAND_COLORS.success
                                : entry.name === 'Active'
                                  ? BRAND_COLORS.primary
                                  : BRAND_COLORS.danger
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[250px] items-center justify-center text-sm text-gray-400">
                    No data available
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SLA Compliance</CardTitle>
              </CardHeader>
              <CardBody>
                {hasSlaData ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={slaComplianceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {slaComplianceData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={
                              entry.name === 'Compliant'
                                ? BRAND_COLORS.success
                                : BRAND_COLORS.danger
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[250px] items-center justify-center text-sm text-gray-400">
                    No data available
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {cases && (
              <Card>
                <CardHeader>
                  <CardTitle>Case Analytics</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Total Cases</span><span className="font-medium">{cases.totalCases}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Open</span><span className="font-medium">{cases.openCases}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Closed</span><span className="font-medium">{cases.closedCases}</span></div>
                    <hr className="my-2 border-gray-100" />
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">By Type</p>
                    {(Object.entries(cases.casesByType) as [string, number][]).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-sm">
                        <Badge variant="blue">{type}</Badge>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            {recovery && (
              <Card>
                <CardHeader>
                  <CardTitle>Recovery Analytics</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Total Plans</span><span className="font-medium">{recovery.totalPlans}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Active</span><span className="font-medium">{recovery.activePlans}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Completed</span><span className="font-medium">{recovery.completedPlans}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Failed</span><span className="font-medium">{recovery.failedPlans}</span></div>
                    <hr className="my-2 border-gray-100" />
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Success Rate</span>
                      <Badge variant={recovery.successRate >= 0.8 ? 'green' : recovery.successRate >= 0.5 ? 'yellow' : 'red'}>{formatPercent(recovery.successRate)}</Badge>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}

            {sla && (
              <Card>
                <CardHeader>
                  <CardTitle>SLA Analytics</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Total Eligible</span><span className="font-medium">{sla.totalEligible}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Compliant</span><span className="font-medium text-emerald-600">{sla.compliant}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Breached</span><span className="font-medium text-red-600">{sla.breached}</span></div>
                    <hr className="my-2 border-gray-100" />
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Compliance Rate</span>
                      <Badge variant={sla.complianceRate >= 0.9 ? 'green' : sla.complianceRate >= 0.7 ? 'yellow' : 'red'}>{formatPercent(sla.complianceRate)}</Badge>
                    </div>
                    {Object.keys(sla.byAirport).length > 0 && (
                      <>
                        <hr className="my-2 border-gray-100" />
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">By Airport</p>
                        {(Object.entries(sla.byAirport) as [string, { eligible: number; compliant: number; rate: number }][]).map(([code, data]) => (
                          <div key={code} className="flex justify-between text-sm">
                            <span className="text-gray-500">{code}</span>
                            <Badge variant={data.rate >= 0.9 ? 'green' : data.rate >= 0.7 ? 'yellow' : 'red'}>{formatPercent(data.rate)}</Badge>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
