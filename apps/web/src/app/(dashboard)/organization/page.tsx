'use client';

import { useState } from 'react';
import { useApi, usePagination } from '@/lib/hooks';
import { organizationApi, usersApi, rolesApi, invitationsApi } from '@/lib/api/organization';
import { PageHeader, Card, Badge, DataTable, Pagination, Tabs } from '@/components/ui';
import { LoadingSpinner, ErrorState, EmptyState, formatDate } from '@/lib/utils';

export default function OrganizationPage() {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'users', label: 'Users' },
    { key: 'roles', label: 'Roles' },
    { key: 'invitations', label: 'Invitations' },
  ];

  return (
    <div className="page-container">
      <PageHeader 
        breadcrumbs={[{ label: 'Network', href: '/organization' }, { label: 'Organization' }]}
        title="Organization & Team Directory" 
        subtitle="Layer 2 Tenant Settings, Memberships & Permissions" 
      />

      <Card>
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        <div className="p-5">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'roles' && <RolesTab />}
          {activeTab === 'invitations' && <InvitationsTab />}
        </div>
      </Card>
    </div>
  );
}

function OverviewTab() {
  const { data, loading, error, refetch } = useApi(() => organizationApi.list(), []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data || data.length === 0) return <EmptyState title="No organization" description="No organization data found" />;

  const org = data[0];
  if (!org) return <EmptyState title="No organization" description="No organization data found" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-gray-500">Name</p>
          <p className="mt-1 text-sm text-gray-900">{org.name}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Slug</p>
          <p className="mt-1 font-mono text-sm text-gray-900">{org.slug}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Type</p>
          <p className="mt-1"><Badge variant="blue">{org.type}</Badge></p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Status</p>
          <p className="mt-1"><Badge variant={org.status === 'active' ? 'green' : 'gray'}>{org.status}</Badge></p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">Created</p>
          <p className="mt-1 text-sm text-gray-900">{formatDate(org.createdAt)}</p>
        </div>
        {org.metadata && (
          <div>
            <p className="text-sm font-medium text-gray-500">Metadata</p>
            <p className="mt-1 font-mono text-xs text-gray-900">{org.metadata}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function UsersTab() {
  const { page, pageSize } = usePagination();
  const { data, loading, error, refetch } = useApi(() => usersApi.list({ page, pageSize }), [page, pageSize]);

  return (
    <>
      {loading ? <LoadingSpinner /> : error ? <ErrorState message={error} onRetry={refetch} /> : !data || data.items.length === 0 ? (
        <EmptyState title="No users" description="No users found in this organization" />
      ) : (
        <>
          <DataTable
            columns={[
              { key: 'email', label: 'Email' },
              { key: 'name', label: 'Name', render: (v) => String(v ?? '-') },
              {
                key: 'membership',
                label: 'Role',
                render: (v) => {
                  const m = v as { role?: string } | undefined;
                  return <Badge variant="blue">{m?.role ?? '-'}</Badge>;
                },
              },
              { key: 'status', label: 'Status', render: (v) => <Badge variant={String(v) === 'active' ? 'green' : 'gray'}>{String(v)}</Badge> },
              { key: 'createdAt', label: 'Joined', render: (v) => formatDate(v as Date | string | null) },
            ]}
            data={data.items as unknown as Record<string, unknown>[]}
          />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={() => {}} />
        </>
      )}
    </>
  );
}

function RolesTab() {
  const { page, pageSize } = usePagination();
  const { data, loading, error, refetch } = useApi(() => rolesApi.list({ page, pageSize }), [page, pageSize]);

  return (
    <>
      {loading ? <LoadingSpinner /> : error ? <ErrorState message={error} onRetry={refetch} /> : !data || data.items.length === 0 ? (
        <EmptyState title="No roles" description="No roles found" />
      ) : (
        <>
          <DataTable
            columns={[
              { key: 'displayName', label: 'Name' },
              { key: 'name', label: 'Slug', render: (v) => <span className="font-mono text-xs">{String(v)}</span> },
              { key: 'description', label: 'Description', render: (v) => String(v ?? '-') },
              {
                key: 'permissions',
                label: 'Permissions',
                render: (v) => {
                  const perms = v as string[] | undefined;
                  return <Badge variant="gray">{perms?.length ?? 0}</Badge>;
                },
              },
              {
                key: 'isSystem',
                label: 'System',
                render: (v) => v ? <Badge variant="yellow">System</Badge> : null,
              },
              {
                key: 'status',
                label: 'Status',
                render: (v) => <Badge variant={String(v) === 'active' ? 'green' : 'gray'}>{String(v)}</Badge>,
              },
            ]}
            data={data.items as unknown as Record<string, unknown>[]}
          />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={() => {}} />
        </>
      )}
    </>
  );
}

function InvitationsTab() {
  const { page, pageSize } = usePagination();
  const { data, loading, error, refetch } = useApi(() => invitationsApi.list({ page, pageSize }), [page, pageSize]);

  function invitationBadge(status: string) {
    switch (status) {
      case 'pending': return 'yellow';
      case 'accepted': return 'green';
      case 'expired': return 'red';
      default: return 'gray';
    }
  }

  return (
    <>
      {loading ? <LoadingSpinner /> : error ? <ErrorState message={error} onRetry={refetch} /> : !data || data.items.length === 0 ? (
        <EmptyState title="No invitations" description="No invitations have been sent" />
      ) : (
        <>
          <DataTable
            columns={[
              { key: 'email', label: 'Email' },
              { key: 'role', label: 'Role', render: (v) => <Badge variant="blue">{String(v)}</Badge> },
              { key: 'status', label: 'Status', render: (v) => <Badge variant={invitationBadge(String(v)) as 'green' | 'yellow' | 'red' | 'gray'}>{String(v)}</Badge> },
              { key: 'expiresAt', label: 'Expires', render: (v) => formatDate(v as Date | string | null) },
              { key: 'acceptedAt', label: 'Accepted', render: (v) => formatDate(v as Date | string | null) },
              { key: 'createdAt', label: 'Sent', render: (v) => formatDate(v as Date | string | null) },
            ]}
            data={data.items as unknown as Record<string, unknown>[]}
          />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={() => {}} />
        </>
      )}
    </>
  );
}
