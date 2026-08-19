'use client';

import { useState, useMemo, useCallback } from 'react';
import { useApi, usePagination, useDebounce } from '@/lib/hooks';
import { baggageApi } from '@/lib/api/baggage';
import { PageHeader, StatCard, Card, DataTable, Pagination, Tabs, StatusBadge, PriorityBadge, LoadingState, ErrorState, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

const WORKSPACE_TABS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'delayed', label: 'Delayed' },
  { key: 'missing', label: 'Missing' },
  { key: 'mishandled', label: 'Mishandled' },
  { key: 'misrouted', label: 'Misrouted' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'exceptions', label: 'Exceptions' },
];

function RouteDisplay({ origin, destination }: { origin: string | null; destination: string | null }) {
  if (!origin && !destination) return <span className="text-gray-400">-</span>;
  return (
    <span className="text-xs font-mono">
      <span className="font-semibold">{origin ?? '?'}</span>
      <span className="mx-1 text-gray-400">&rarr;</span>
      <span className="font-semibold">{destination ?? '?'}</span>
    </span>
  );
}

export default function BaggagePage() {
  const { page, pageSize, setPage } = usePagination(1, 20);
  const [activeTab, setActiveTab] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data, loading, error, refetch } = useApi(
    () => baggageApi.list({ page, pageSize, status: activeTab || undefined, priority: priorityFilter || undefined }),
    [page, pageSize, activeTab, priorityFilter],
  );

  const filteredItems = useMemo(() => {
    if (!data) return [];
    if (!debouncedSearch.trim()) return data.items;
    const q = debouncedSearch.trim().toLowerCase();
    return data.items.filter((item) => 
      item.tagNumber.toLowerCase().includes(q) || 
      (item.passengerName && item.passengerName.toLowerCase().includes(q)) ||
      (item.currentLocation && item.currentLocation.toLowerCase().includes(q))
    );
  }, [data, debouncedSearch]);

  const stats = useMemo(() => {
    if (!data) return { total: 0, active: 0, missing: 0, delayed: 0, exceptions: 0 };
    const all = data.items;
    return {
      total: data.total,
      active: all.filter((i) => i.currentState === 'in_transit' || i.currentState === 'active').length,
      missing: all.filter((i) => i.currentState === 'missing' || i.currentState === 'mishandled').length,
      delayed: all.filter((i) => i.currentState === 'delayed').length,
      exceptions: all.filter((i) => ['missing', 'mishandled', 'misrouted', 'delayed'].includes(i.currentState)).length,
    };
  }, [data]);

  return (
    <div className="page-container">
      <PageHeader 
        breadcrumbs={[{ label: 'Operations', href: '/baggage' }, { label: 'Baggage' }]}
        title="Baggage Operations Workspace" 
        subtitle="Operational intelligence & custody tracking for airline baggage exceptions" 
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 mb-6">
        <StatCard label="Total Baggage" value={stats.total} />
        <StatCard label="Active In-Transit" value={stats.active} />
        <StatCard label="Missing / Lost" value={stats.missing} />
        <StatCard label="Delayed" value={stats.delayed} />
        <StatCard label="Exceptions" value={stats.exceptions} />
      </div>

      <Card>
        <Tabs tabs={WORKSPACE_TABS} active={activeTab} onChange={(k) => { setActiveTab(k); setPage(1); }} />

        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <input
            type="text"
            placeholder="Filter tag, passenger, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-64 text-xs"
          />
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
            className="select w-40 text-xs"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={refetch} className="btn btn-secondary btn-sm">Refresh Data</button>
          </div>
        </div>

        {loading ? (
          <LoadingState message="Loading baggage operations data..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : filteredItems.length === 0 ? (
          <EmptyState title="No baggage records found" message="No baggage matched your operational query." />
        ) : (
          <>
            <DataTable
              columns={[
                {
                  key: 'tagNumber',
                  label: 'Baggage Tag ID',
                  render: (v, row) => (
                    <Link href={`/baggage/${String(row['id'])}`} className="font-mono text-xs font-bold text-brand-600 hover:underline">
                      {String(v)}
                    </Link>
                  ),
                },
                {
                  key: 'passengerName',
                  label: 'Passenger / Ref',
                  render: (v, row) => (
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{String(v ?? 'Unknown')}</p>
                      <p className="text-[10px] font-mono text-gray-500">{String(row['passengerReference'] ?? '-')}</p>
                    </div>
                  ),
                },
                {
                  key: 'currentState',
                  label: 'Operational Status',
                  render: (v) => <StatusBadge status={String(v)} />,
                },
                {
                  key: 'priority',
                  label: 'Priority',
                  render: (v) => <PriorityBadge priority={String(v)} />,
                },
                {
                  key: '_route',
                  label: 'Route',
                  render: (_v, row) => (
                    <RouteDisplay
                      origin={row['originAirportId'] as string | null}
                      destination={row['destinationAirportId'] as string | null}
                    />
                  ),
                },
                {
                  key: 'currentLocation',
                  label: 'Current Location',
                  render: (v, row) => (
                    <div>
                      <p className="text-xs font-medium text-gray-900">{String(v ?? 'In Transit')}</p>
                      <p className="text-[10px] text-gray-500">{String(row['currentCustodian'] ?? 'System Custody')}</p>
                    </div>
                  ),
                },
                {
                  key: 'updatedAt',
                  label: 'Last Update',
                  render: (v) => <span className="text-xs text-gray-500">{formatDate(v as Date | string | null)}</span>,
                },
                {
                  key: 'actions',
                  label: 'Action',
                  render: (_v, row) => (
                    <Link href={`/baggage/${String(row['id'])}`} className="btn btn-secondary btn-xs text-[11px]">
                      Workspace
                    </Link>
                  ),
                },
              ]}
              data={filteredItems as unknown as Record<string, unknown>[]}
              onRowClick={(row) => { window.location.href = `/baggage/${String(row['id'])}`; }}
            />
            <Pagination
              page={data!.page}
              totalPages={data!.totalPages}
              onPageChange={(p) => setPage(p)}
            />
          </>
        )}
      </Card>
    </div>
  );
}
