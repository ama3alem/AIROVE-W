'use client';

import { useRouter } from 'next/navigation';
import { useApi } from '@/lib/hooks';
import { analyticsApi, type CommandCenterOverview, type AnalyticsAlert } from '@/lib/api/analytics';
import { baggageApi, type Baggage } from '@/lib/api/baggage';
import { casesApi, type Case } from '@/lib/api/cases';
import { actionProposalsApi, type AIActionProposal } from '@/lib/api/action-proposals';
import { PageHeader, StatCard, Card, CardHeader, CardTitle, CardBody, Badge } from '@/components/ui';
import { formatPercent, formatDateTime, EmptyState, LoadingSpinner, ErrorState } from '@/lib/utils';

function HealthBar({ label, value }: { label: string; value: number }) {
  const color = value >= 90 ? 'bg-emerald-500' : value >= 75 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700 w-10 text-right">{value}%</span>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const v = priority === 'critical' ? 'red' : priority === 'high' ? 'yellow' : priority === 'medium' ? 'blue' : 'gray';
  return <Badge variant={v as 'red' | 'yellow' | 'blue' | 'gray'}>{priority}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, 'green' | 'yellow' | 'red' | 'blue' | 'gray'> = {
    active: 'green', open: 'green', in_progress: 'green', in_transit: 'green',
    missing: 'red', lost: 'red', damaged: 'red',
    pending: 'yellow', triaged: 'yellow', assigned: 'yellow', investigating: 'yellow',
    resolved: 'blue', closed: 'blue', delivered: 'blue',
    cancelled: 'gray', on_hold: 'gray',
  };
  return <Badge variant={map[status] ?? 'gray'}>{status.replace(/_/g, ' ')}</Badge>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const v = severity === 'critical' || severity === 'high' ? 'red' : severity === 'warning' || severity === 'medium' ? 'yellow' : 'gray';
  return <Badge variant={v as 'red' | 'yellow' | 'gray'}>{severity}</Badge>;
}

export function DashboardPage() {
  const router = useRouter();

  const { data, loading, error, refetch } = useApi<CommandCenterOverview>(() => analyticsApi.getOverview());
  const { data: missingBaggage } = useApi(() => baggageApi.list({ page: 1, pageSize: 5, status: 'missing' }), []);
  const { data: activeCases } = useApi(() => casesApi.list({ page: 1, pageSize: 5 }), []);
  const { data: alerts } = useApi<AnalyticsAlert[]>(() => analyticsApi.getAlerts({ status: 'active' }), []);
  const { data: pendingProposals } = useApi<AIActionProposal[]>(() => actionProposalsApi.list({ status: 'pending' }), []);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="page-container"><ErrorState message={error} onRetry={refetch} /></div>;
  if (!data) return <div className="page-container"><EmptyState title="No data" description="No command center data available" /></div>;

  const missingItems = missingBaggage?.items ?? [];
  const caseItems = activeCases?.items ?? [];
  const recentAlerts = (alerts ?? []).slice(0, 5);
  const pendingCount = (pendingProposals ?? []).length;

  return (
    <div className="page-container">
      <PageHeader title="Command Center" subtitle="Real-time aviation operations overview" />

      {data.slaCompliance < 0.9 && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <svg className="h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">SLA Compliance Below Threshold</p>
            <p className="text-xs text-amber-700">Current compliance is {formatPercent(data.slaCompliance)}. Target is 90% or above.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Baggage" value={data.activeBaggage} icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>} />
        <StatCard label="Open Cases" value={data.openCases} change={`${data.criticalCases} critical`} changeType="down" icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25" /></svg>} />
        <StatCard label="At-Risk Baggage" value={data.atRiskBaggage} icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>} />
        <StatCard label="SLA Compliance" value={formatPercent(data.slaCompliance)} icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Recovery Plans" value={data.activeRecoveryPlans} />
        <StatCard label="Transfer Failures" value={data.transferFailures} />
        <StatCard label="Active Alerts" value={data.activeAlerts} />
        <StatCard label="Critical Cases" value={data.criticalCases} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Critical Baggage</CardTitle>
              <Badge variant="red">{missingItems.length} missing</Badge>
            </div>
          </CardHeader>
          <CardBody>
            {missingItems.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">No missing baggage</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="pb-2 pr-4">Tag</th>
                      <th className="pb-2 pr-4">Passenger</th>
                      <th className="pb-2 pr-4">State</th>
                      <th className="pb-2 pr-4">Priority</th>
                      <th className="pb-2">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingItems.map((b) => (
                      <tr
                        key={b.id}
                        onClick={() => router.push(`/baggage/${b.id}`)}
                        className="cursor-pointer border-b border-gray-50 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-2.5 pr-4 font-medium text-gray-900">{b.tagNumber}</td>
                        <td className="py-2.5 pr-4 text-gray-600">{b.passengerName ?? '-'}</td>
                        <td className="py-2.5 pr-4"><StatusBadge status={b.currentState} /></td>
                        <td className="py-2.5 pr-4"><PriorityBadge priority={b.priority} /></td>
                        <td className="py-2.5 text-gray-500">{b.currentLocation ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Active Cases</CardTitle>
              <Badge variant="blue">{caseItems.length} open</Badge>
            </div>
          </CardHeader>
          <CardBody>
            {caseItems.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">No active cases</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="pb-2 pr-4">Case</th>
                      <th className="pb-2 pr-4">Title</th>
                      <th className="pb-2 pr-4">Priority</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Assigned To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caseItems.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => router.push(`/cases/${c.id}`)}
                        className="cursor-pointer border-b border-gray-50 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-2.5 pr-4 font-medium text-gray-900">{c.caseNumber}</td>
                        <td className="py-2.5 pr-4 text-gray-600 truncate max-w-[160px]">{c.title ?? '-'}</td>
                        <td className="py-2.5 pr-4"><PriorityBadge priority={c.priority} /></td>
                        <td className="py-2.5 pr-4"><StatusBadge status={c.status} /></td>
                        <td className="py-2.5 text-gray-500">{c.assignedTo ?? 'Unassigned'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Alerts</CardTitle>
              {recentAlerts.length > 0 && <Badge variant="red">{recentAlerts.length}</Badge>}
            </div>
          </CardHeader>
          <CardBody>
            {recentAlerts.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">No active alerts</p>
            ) : (
              <div className="space-y-3">
                {recentAlerts.map((alert) => (
                  <div key={alert.id} className="border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{alert.ruleName}</span>
                      <SeverityBadge severity={alert.severity} />
                    </div>
                    <p className="text-xs text-gray-600 mb-1">{alert.message}</p>
                    <p className="text-xs text-gray-400">{formatDateTime(alert.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pending Approvals</CardTitle>
              {pendingCount > 0 && <Badge variant="yellow">{pendingCount} pending</Badge>}
            </div>
          </CardHeader>
          <CardBody>
            {pendingCount === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">No pending approvals</p>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-center">
                  <p className="text-3xl font-bold text-amber-700">{pendingCount}</p>
                  <p className="text-sm text-amber-600 mt-1">action {pendingCount === 1 ? 'proposal' : 'proposals'} awaiting human approval</p>
                </div>
                {(pendingProposals ?? []).slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.actionType}</p>
                      <p className="text-xs text-gray-500">{p.targetType} &middot; {p.reason.slice(0, 60)}{p.reason.length > 60 ? '...' : ''}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Airport Health</CardTitle>
        </CardHeader>
        <CardBody>
          {data.airportHealth.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No airport health data available</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {data.airportHealth.map((ap) => (
                <div key={ap.airportCode} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{ap.airportCode}</span>
                      <span className="text-xs text-gray-500">{ap.airportName}</span>
                    </div>
                    <Badge variant={ap.overallHealth >= 90 ? 'green' : ap.overallHealth >= 75 ? 'yellow' : 'red'}>
                      {ap.overallHealth}% Health
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <HealthBar label="Transfer" value={ap.transferPerformance} />
                    <HealthBar label="SLA" value={ap.slaCompliance} />
                    <HealthBar label="Recovery" value={ap.recoveryPerformance} />
                    <HealthBar label="Provider" value={ap.providerPerformance} />
                    <HealthBar label="System" value={ap.systemReliability} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
