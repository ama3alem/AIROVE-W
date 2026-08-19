'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApi, usePagination, useDebounce } from '@/lib/hooks';
import { casesApi, type Case } from '@/lib/api/cases';
import { PageHeader, Card, StatCard, DataTable, Pagination, Tabs, StatusBadge, PriorityBadge, LoadingState, ErrorState, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

const CASE_TABS = [
  { key: '', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'pending', label: 'Pending' },
  { key: 'escalated', label: 'Escalated' },
  { key: 'sla_at_risk', label: 'SLA At Risk' },
  { key: 'critical', label: 'Critical' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

export default function CasesPage() {
  const router = useRouter();
  const { page, pageSize, setPage } = usePagination(1, 20);

  const [activeTab, setActiveTab] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [caseTypeFilter, setCaseTypeFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);

  const { data, loading, error, refetch } = useApi(
    () => casesApi.list({
      page,
      pageSize,
      status: activeTab === 'open' || activeTab === 'pending' || activeTab === 'resolved' || activeTab === 'closed' ? activeTab : undefined,
      priority: activeTab === 'critical' ? 'CRITICAL' : priorityFilter || undefined,
      caseType: caseTypeFilter || undefined,
    }),
    [page, pageSize, activeTab, priorityFilter, caseTypeFilter],
  );

  const allCases = (data?.items ?? []) as Case[];

  const filteredCases = useMemo(() => {
    let result = allCases;

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) => c.caseNumber.toLowerCase().includes(q) || (c.title ?? '').toLowerCase().includes(q),
      );
    }

    if (activeTab === 'escalated') {
      result = result.filter((c) => c.escalatedAt !== null);
    }

    return result;
  }, [allCases, debouncedSearch, activeTab]);

  const stats = useMemo(() => {
    return {
      total: data?.total ?? 0,
      open: allCases.filter((c) => ['open', 'in_progress', 'assigned'].includes(c.status)).length,
      critical: allCases.filter((c) => c.priority === 'CRITICAL' || c.priority === 'HIGH').length,
      resolved: allCases.filter((c) => ['resolved', 'closed'].includes(c.status)).length,
      slaAtRisk: allCases.filter((c) => c.escalatedAt !== null || c.priority === 'CRITICAL').length,
    };
  }, [data, allCases]);

  return (
    <div className="page-container">
      <PageHeader 
        breadcrumbs={[{ label: 'Operations', href: '/cases' }, { label: 'Cases' }]}
        title="Case Operations Workspace" 
        subtitle="Manage baggage resolution cases, team assignments, and SLA performance" 
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 mb-6">
        <StatCard label="Total Cases" value={stats.total} />
        <StatCard label="Active Open" value={stats.open} />
        <StatCard label="Critical Priority" value={stats.critical} />
        <StatCard label="SLA At Risk" value={stats.slaAtRisk} />
        <StatCard label="Resolved / Closed" value={stats.resolved} />
      </div>

      <Card>
        <Tabs tabs={CASE_TABS} active={activeTab} onChange={(k) => { setActiveTab(k); setPage(1); }} />

        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <input
            type="text"
            placeholder="Search case # or title..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input w-64 text-xs"
          />
          <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }} className="select w-40 text-xs">
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select value={caseTypeFilter} onChange={(e) => { setCaseTypeFilter(e.target.value); setPage(1); }} className="select w-44 text-xs">
            <option value="">All Case Types</option>
            <option value="mishandling">Mishandling</option>
            <option value="delay">Delay</option>
            <option value="damage">Damage</option>
            <option value="lost">Lost</option>
            <option value="complaint">Complaint</option>
          </select>
          <button onClick={refetch} className="btn btn-secondary btn-sm ml-auto">Refresh Queue</button>
        </div>

        {loading ? (
          <LoadingState message="Loading operational case workspace..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : filteredCases.length === 0 ? (
          <EmptyState title="No operational cases found" message="No case records matched your current queue filters." />
        ) : (
          <>
            <DataTable
              columns={[
                {
                  key: 'caseNumber',
                  label: 'Case ID',
                  render: (v, row) => (
                    <Link href={`/cases/${String(row['id'])}`} className="font-mono text-xs font-bold text-brand-600 hover:underline">
                      {String(v)}
                    </Link>
                  ),
                },
                {
                  key: 'baggageId',
                  label: 'Baggage Tag',
                  render: (v) => (
                    v ? (
                      <Link href={`/baggage/${String(v)}`} className="font-mono text-xs text-gray-700 hover:underline">
                        TAG-{String(v).slice(0, 8)}
                      </Link>
                    ) : <span className="text-gray-400 text-xs">-</span>
                  ),
                },
                {
                  key: 'title',
                  label: 'Case Summary',
                  render: (v, row) => (
                    <div>
                      <p className="text-xs font-semibold text-gray-900 line-clamp-1">{String(v ?? 'Operational Case')}</p>
                      <p className="text-[10px] text-gray-500">{String(row['caseType'] ?? 'General')}</p>
                    </div>
                  ),
                },
                {
                  key: 'priority',
                  label: 'Priority',
                  render: (v) => <PriorityBadge priority={String(v)} />,
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (v) => <StatusBadge status={String(v)} />,
                },
                {
                  key: 'assignedTo',
                  label: 'Assigned Owner',
                  render: (v) => (
                    v
                      ? <span className="text-xs font-medium text-gray-900">{String(v)}</span>
                      : <span className="text-xs text-gray-400 italic">Unassigned</span>
                  ),
                },
                {
                  key: 'createdAt',
                  label: 'Created',
                  render: (v) => <span className="text-xs text-gray-500">{formatDate(v as Date | string | null)}</span>,
                },
                {
                  key: 'actions',
                  label: 'Action',
                  render: (_v, row) => (
                    <Link href={`/cases/${String(row['id'])}`} className="btn btn-secondary btn-xs text-[11px]">
                      Workspace
                    </Link>
                  ),
                },
              ]}
              data={filteredCases as unknown as Record<string, unknown>[]}
              onRowClick={(row) => {
                const id = row['id'];
                if (id) router.push(`/cases/${String(id)}`);
              }}
            />
            <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
