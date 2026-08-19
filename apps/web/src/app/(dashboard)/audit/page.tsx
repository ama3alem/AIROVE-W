'use client';

import { useState } from 'react';
import { useApi, usePagination } from '@/lib/hooks';
import { auditApi } from '@/lib/api/organization';
import { PageHeader, Card, Badge, DataTable, Pagination } from '@/components/ui';
import { LoadingSpinner, ErrorState, EmptyState, formatDateTime } from '@/lib/utils';

const ENTITY_TYPES = ['', 'case', 'baggage', 'user', 'organization', 'role', 'invitation', 'notification'];
const ACTIONS = ['', 'create', 'read', 'update', 'delete', 'assign', 'suspend', 'accept'];

export default function AuditPage() {
  const { page, pageSize } = usePagination();
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');

  const { data, loading, error, refetch } = useApi(
    () => auditApi.list({ page, pageSize, entityType: entityType || undefined, action: action || undefined }),
    [page, pageSize, entityType, action]
  );

  function actionBadge(a: string) {
    switch (a) {
      case 'create': return 'green';
      case 'update': return 'blue';
      case 'delete': return 'red';
      case 'assign': return 'yellow';
      case 'suspend': return 'red';
      default: return 'gray';
    }
  }

  return (
    <div className="page-container">
      <PageHeader 
        breadcrumbs={[{ label: 'Governance', href: '/audit' }, { label: 'Audit Logs' }]}
        title="Immutable Audit Logs" 
        subtitle="Layer 2 Enterprise Security, User Activity & Operations Audit Trail" 
      />

      <Card>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="select w-44">
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{t || 'All Entity Types'}</option>
              ))}
            </select>
            <select value={action} onChange={(e) => setAction(e.target.value)} className="select w-40">
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{a || 'All Actions'}</option>
              ))}
            </select>
          </div>
          <button onClick={refetch} className="btn btn-secondary btn-sm">Refresh</button>
        </div>

        {loading ? <LoadingSpinner /> : error ? <ErrorState message={error} onRetry={refetch} /> : !data || data.items.length === 0 ? (
          <EmptyState title="No audit logs" description="No audit entries match your filters" />
        ) : (
          <>
            <DataTable
              columns={[
                { key: 'createdAt', label: 'Timestamp', render: (v) => <span className="text-xs">{formatDateTime(v as Date | string | null)}</span> },
                { key: 'userId', label: 'User', render: (v) => <span className="font-mono text-xs">{String(v ?? 'system')}</span> },
                { key: 'action', label: 'Action', render: (v) => <Badge variant={actionBadge(String(v)) as 'green' | 'blue' | 'red' | 'yellow' | 'gray'}>{String(v)}</Badge> },
                { key: 'entityType', label: 'Entity Type', render: (v) => <Badge variant="blue">{String(v)}</Badge> },
                { key: 'entityId', label: 'Entity ID', render: (v) => <span className="font-mono text-xs">{String(v ?? '-')}</span> },
                { key: 'entityRef', label: 'Entity Ref', render: (v) => String(v ?? '-') },
              ]}
              data={data.items as unknown as Record<string, unknown>[]}
            />
            <Pagination page={data.page} totalPages={data.totalPages} onPageChange={() => {}} />
          </>
        )}
      </Card>
    </div>
  );
}
