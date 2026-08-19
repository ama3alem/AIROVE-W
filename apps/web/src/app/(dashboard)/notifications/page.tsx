'use client';

import { useState } from 'react';
import { useApi, usePagination } from '@/lib/hooks';
import { notificationsApi } from '@/lib/api/organization';
import { PageHeader, Card, Badge } from '@/components/ui';
import { LoadingSpinner, ErrorState, EmptyState, formatDateTime, severityColor } from '@/lib/utils';

export default function NotificationsPage() {
  const { page, pageSize } = usePagination();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, loading, error, refetch } = useApi(
    () => notificationsApi.list({ page, pageSize }),
    [page, pageSize, refreshKey]
  );

  async function handleMarkRead(id: string) {
    try {
      await notificationsApi.markRead(id);
      setRefreshKey((k) => k + 1);
    } catch {
      // silently fail
    }
  }

  function severityBadge(s: string) {
    return severityColor(s) as 'green' | 'yellow' | 'red' | 'blue' | 'gray';
  }

  return (
    <div className="page-container">
      <PageHeader 
        breadcrumbs={[{ label: 'Governance', href: '/notifications' }, { label: 'Notifications' }]}
        title="Operational Notifications" 
        subtitle="System alerts, case updates, and action notifications" 
      />

      <Card>
        {loading ? <LoadingSpinner /> : error ? <ErrorState message={error} onRetry={refetch} /> : !data || data.items.length === 0 ? (
          <EmptyState title="No notifications" description="You're all caught up!" />
        ) : (
          <div className="divide-y divide-gray-100">
            {data.items.map((n) => (
              <div key={n.id} className={`flex items-start justify-between px-5 py-4 ${!n.read ? 'bg-blue-50/50' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${!n.read ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                    <Badge variant={severityBadge(n.severity)}>{n.severity}</Badge>
                    <Badge variant="gray">{n.type}</Badge>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                  </div>
                  {n.body && <p className="mt-1 text-sm text-gray-500">{n.body}</p>}
                  <p className="mt-1 text-xs text-gray-400">{formatDateTime(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <button onClick={() => handleMarkRead(n.id)} className="btn btn-secondary btn-sm ml-4 shrink-0">
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Page {data.page} of {data.totalPages}</p>
            <div className="flex gap-1">
              <button onClick={() => {}} disabled={data.page <= 1} className="btn btn-secondary btn-sm">Previous</button>
              <button onClick={() => {}} disabled={data.page >= data.totalPages} className="btn btn-secondary btn-sm">Next</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
