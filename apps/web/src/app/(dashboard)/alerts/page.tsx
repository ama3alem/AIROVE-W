'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { analyticsApi, type AnalyticsAlert } from '@/lib/api/analytics';
import { PageHeader, Card, Badge } from '@/components/ui';
import { LoadingSpinner, ErrorState, EmptyState, formatDateTime, severityColor } from '@/lib/utils';

type StatusFilter = '' | 'active' | 'acknowledged' | 'resolved';

const SEVERITY_BADGE: Record<string, 'red' | 'yellow' | 'gray'> = {
  critical: 'red',
  warning: 'yellow',
  info: 'gray',
};

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: alerts, loading, error, refetch } = useApi(
    () => analyticsApi.getAlerts(statusFilter ? { status: statusFilter } : undefined),
    [statusFilter]
  );

  async function handleAcknowledge(id: string) {
    setActionLoading(id);
    try {
      await analyticsApi.acknowledgeAlert(id);
      refetch();
    } catch {
      // silently fail, refetch will show current state
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResolve(id: string) {
    setActionLoading(id);
    try {
      await analyticsApi.resolveAlert(id);
      refetch();
    } catch {
      // silently fail, refetch will show current state
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="page-container">
      <PageHeader
        breadcrumbs={[{ label: 'Analytics', href: '/analytics' }, { label: 'Alerts' }]}
        title="Operational Alerts"
        subtitle="Layer 7 Threshold Monitoring & Automated Alarm Center"
        actions={
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="select w-40"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
            <button onClick={refetch} className="btn btn-secondary btn-sm">Refresh</button>
          </div>
        }
      />

      <Card>
        {loading ? <LoadingSpinner /> : error ? <ErrorState message={error} onRetry={refetch} /> : !alerts || alerts.length === 0 ? (
          <EmptyState title="No alerts" description="No alerts match your current filters" />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Rule Name</th>
                  <th>Metric</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Value vs Threshold</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert: AnalyticsAlert) => (
                  <tr key={alert.id}>
                    <td><Badge variant={SEVERITY_BADGE[alert.severity] ?? 'gray'}>{alert.severity}</Badge></td>
                    <td className="text-sm font-medium">{alert.ruleName}</td>
                    <td className="text-sm text-gray-500">{alert.metricName}</td>
                    <td className="text-sm max-w-xs truncate">{alert.message}</td>
                    <td>
                      <Badge variant={alert.status === 'resolved' ? 'green' : alert.status === 'acknowledged' ? 'blue' : 'red'}>
                        {alert.status}
                      </Badge>
                    </td>
                    <td className="text-sm font-mono">
                      <span className="font-semibold">{alert.actualValue}</span>
                      <span className="text-gray-400"> / </span>
                      <span>{alert.threshold}</span>
                    </td>
                    <td className="text-sm text-gray-500">{formatDateTime(alert.createdAt)}</td>
                    <td>
                      {alert.status === 'active' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            disabled={actionLoading === alert.id}
                            className="btn btn-secondary btn-xs"
                          >
                            Acknowledge
                          </button>
                          <button
                            onClick={() => handleResolve(alert.id)}
                            disabled={actionLoading === alert.id}
                            className="btn btn-primary btn-xs"
                          >
                            Resolve
                          </button>
                        </div>
                      )}
                      {alert.status === 'acknowledged' && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          disabled={actionLoading === alert.id}
                          className="btn btn-primary btn-xs"
                        >
                          Resolve
                        </button>
                      )}
                      {alert.status === 'resolved' && (
                        <span className="text-xs text-gray-400">Resolved</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
