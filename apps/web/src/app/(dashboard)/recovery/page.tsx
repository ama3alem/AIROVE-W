'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { recoveryApi, type RecoveryPlan } from '@/lib/api/recovery';
import { useApi, usePagination, useDebounce } from '@/lib/hooks';
import { PageHeader, Card, StatCard, DataTable, Pagination, Tabs, StatusBadge, PriorityBadge, RiskBadge, SLABadge, LoadingState, ErrorState, EmptyState } from '@/components/ui';

const RECOVERY_TABS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'planning', label: 'Planning' },
  { key: 'awaiting_approval', label: 'Awaiting Approval' },
  { key: 'approved', label: 'Approved' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
  { key: 'replanning', label: 'Replanning' },
];

export default function RecoveryPlansPage() {
  const [activeTab, setActiveTab] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { page, pageSize, setPage } = usePagination(1, 20);

  const { data, loading, error, refetch } = useApi(
    () => recoveryApi.list({
      status: activeTab || undefined,
      recoveryType: typeFilter || undefined,
      page,
      pageSize
    }),
    [activeTab, typeFilter, page, pageSize]
  );

  const plans = (data?.items ?? []) as RecoveryPlan[];

  const filteredPlans = useMemo(() => {
    let result = plans;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(p => 
        p.planNumber.toLowerCase().includes(q) || 
        p.origin.toLowerCase().includes(q) || 
        p.destination.toLowerCase().includes(q)
      );
    }
    if (riskFilter) {
      result = result.filter(p => p.riskLevel?.toLowerCase() === riskFilter.toLowerCase());
    }
    return result;
  }, [plans, debouncedSearch, riskFilter]);

  const stats = useMemo(() => {
    return {
      total: data?.total ?? 0,
      active: plans.filter(p => ['in_progress', 'scheduled', 'executing', 'active'].includes(p.status)).length,
      awaitingApproval: plans.filter(p => ['draft', 'pending_approval', 'awaiting_approval'].includes(p.status)).length,
      highRisk: plans.filter(p => p.riskLevel?.toLowerCase() === 'high' || p.riskLevel?.toLowerCase() === 'critical').length,
    };
  }, [data, plans]);

  return (
    <div className="page-container">
      <PageHeader 
        breadcrumbs={[{ label: 'Operations', href: '/recovery' }, { label: 'Recovery' }]}
        title="Recovery Command Center" 
        subtitle="Layer 6 Recovery Route Planning, Dispatch & Execution Workspace" 
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        <StatCard label="Total Recovery Plans" value={stats.total} />
        <StatCard label="Active In Execution" value={stats.active} />
        <StatCard label="Awaiting Approval" value={stats.awaitingApproval} />
        <StatCard label="High Risk Operations" value={stats.highRisk} />
      </div>

      <Card>
        <Tabs tabs={RECOVERY_TABS} active={activeTab} onChange={(k) => { setActiveTab(k); setPage(1); }} />

        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <input
            type="text"
            placeholder="Search plan #, origin, destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-64 text-xs"
          />
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="select w-40 text-xs"
          >
            <option value="">All Risk Levels</option>
            <option value="low">Low Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="high">High Risk</option>
            <option value="critical">Critical Risk</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="select w-44 text-xs"
          >
            <option value="">All Recovery Types</option>
            <option value="EXPEDITED_FLIGHT">Expedited Flight</option>
            <option value="GROUND_COURIER">Ground Courier</option>
            <option value="PARTNER_HANDOVER">Partner Handover</option>
          </select>
          <button onClick={refetch} className="btn btn-secondary btn-sm ml-auto">Refresh Operations</button>
        </div>

        {loading ? (
          <LoadingState message="Loading recovery plan command center..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : filteredPlans.length === 0 ? (
          <EmptyState title="No recovery plans found" message="No recovery plans match your current operational filters." />
        ) : (
          <>
            <DataTable
              columns={[
                {
                  key: 'planNumber',
                  label: 'Plan ID',
                  render: (v, row) => (
                    <Link href={`/recovery/${String(row['id'])}`} className="font-mono text-xs font-bold text-brand-600 hover:underline">
                      {String(v)}
                    </Link>
                  ),
                },
                {
                  key: 'recoveryType',
                  label: 'Mode / Type',
                  render: (v) => <span className="badge badge-blue font-mono text-[10px]">{String(v)}</span>,
                },
                {
                  key: 'origin',
                  label: 'Route Path',
                  render: (_v, row) => (
                    <div className="text-xs">
                      <span className="font-mono font-bold text-gray-900">{String(row['origin'] ?? '?')}</span>
                      <span className="mx-1.5 text-gray-400">&rarr;</span>
                      <span className="font-mono font-bold text-gray-900">{String(row['destination'] ?? '?')}</span>
                    </div>
                  ),
                },
                {
                  key: 'status',
                  label: 'Plan Status',
                  render: (v) => <StatusBadge status={String(v)} />,
                },
                {
                  key: 'riskLevel',
                  label: 'Risk Assessment',
                  render: (v) => <RiskBadge risk={v as string | null} />,
                },
                {
                  key: 'slaRemainingMinutes',
                  label: 'SLA Margin',
                  render: (v) => <SLABadge remainingMinutes={v as number | null} />,
                },
                {
                  key: 'estimatedCost',
                  label: 'Est. Cost',
                  render: (v) => (
                    <span className="text-xs font-mono font-semibold text-gray-900">
                      {v != null ? `$${Number(v).toFixed(2)}` : '-'}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  label: 'Command',
                  render: (_v, row) => (
                    <Link href={`/recovery/${String(row['id'])}`} className="btn btn-primary btn-xs text-[11px]">
                      Open Plan
                    </Link>
                  ),
                },
              ]}
              data={filteredPlans as unknown as Record<string, unknown>[]}
              onRowClick={(row) => { window.location.href = `/recovery/${row['id']}`; }}
            />
            <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
