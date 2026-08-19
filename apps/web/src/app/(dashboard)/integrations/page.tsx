'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { integrationsApi, type Integration } from '@/lib/api/integrations';
import { PageHeader, Card, Badge } from '@/components/ui';
import { LoadingSpinner, ErrorState, EmptyState, formatDateTime } from '@/lib/utils';

const STATUS_BADGE: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  active: 'green',
  configuring: 'yellow',
  failing: 'red',
  paused: 'gray',
  disabled: 'gray',
};

export default function IntegrationsPage() {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: integrations, loading, error, refetch } = useApi(() => integrationsApi.list(), []);

  async function handleTest(id: string) {
    setActionLoading(id);
    try {
      await integrationsApi.test(id);
      refetch();
    } catch {
      // silently fail
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePause(id: string) {
    setActionLoading(id);
    try {
      await integrationsApi.pause(id);
      refetch();
    } catch {
      // silently fail
    } finally {
      setActionLoading(null);
    }
  }

  async function handleActivate(id: string) {
    setActionLoading(id);
    try {
      await integrationsApi.activate(id);
      refetch();
    } catch {
      // silently fail
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Integrations"
        subtitle="Manage external system integrations"
        actions={<button onClick={refetch} className="btn btn-secondary btn-sm">Refresh</button>}
      />

      {loading ? <LoadingSpinner /> : error ? <ErrorState message={error} onRetry={refetch} /> : !integrations || integrations.length === 0 ? (
        <EmptyState title="No integrations" description="No integrations have been configured yet" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {integrations.map((int: Integration) => (
            <Card key={int.id}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{int.name}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="blue">{int.type}</Badge>
                      {int.provider && <span className="text-xs text-gray-400">{int.provider}</span>}
                    </div>
                  </div>
                  <Badge variant={STATUS_BADGE[int.status] ?? 'gray'}>{int.status}</Badge>
                </div>

                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Events Received</span>
                    <span className="font-medium">{int.totalEventsReceived.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Events Failed</span>
                    <span className={`font-medium ${int.totalEventsFailed > 0 ? 'text-red-600' : ''}`}>{int.totalEventsFailed.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Consecutive Failures</span>
                    <span className={`font-medium ${int.consecutiveFailures > 0 ? 'text-red-600' : ''}`}>{int.consecutiveFailures}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Last Sync</span>
                    <span className="font-medium">{formatDateTime(int.lastSyncAt)}</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => handleTest(int.id)}
                    disabled={actionLoading === int.id}
                    className="btn btn-secondary btn-sm flex-1"
                  >
                    Test
                  </button>
                  {int.status === 'active' || int.status === 'failing' || int.status === 'configuring' ? (
                    <button
                      onClick={() => handlePause(int.id)}
                      disabled={actionLoading === int.id}
                      className="btn btn-secondary btn-sm flex-1"
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={() => handleActivate(int.id)}
                      disabled={actionLoading === int.id}
                      className="btn btn-primary btn-sm flex-1"
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
