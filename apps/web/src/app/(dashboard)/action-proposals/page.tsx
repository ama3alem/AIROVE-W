'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { actionProposalsApi, type AIActionProposal } from '@/lib/api/action-proposals';
import { PageHeader, Card, CardHeader, CardTitle, CardBody, Badge, Tabs, ConfirmDialog } from '@/components/ui';
import { LoadingSpinner, ErrorState, EmptyState, formatDateTime, confidenceColor } from '@/lib/utils';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'PENDING_APPROVAL', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'EXECUTED', label: 'Executed' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'EXPIRED', label: 'Expired' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

function statusColor(status: string) {
  switch (status) {
    case 'PENDING_APPROVAL': return 'yellow' as const;
    case 'APPROVED': return 'green' as const;
    case 'REJECTED': return 'red' as const;
    case 'EXECUTED': return 'green' as const;
    case 'FAILED': return 'red' as const;
    case 'EXPIRED': return 'gray' as const;
    case 'CANCELLED': return 'gray' as const;
    default: return 'gray' as const;
  }
}

function riskColor(risk: string) {
  switch (risk) {
    case 'HIGH': return 'red' as const;
    case 'MEDIUM': return 'yellow' as const;
    case 'LOW': return 'blue' as const;
    default: return 'gray' as const;
  }
}

export default function ActionProposalsPage() {
  const [activeStatus, setActiveStatus] = useState('all');
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'reject'; id: string } | null>(null);
  const [acting, setActing] = useState(false);

  const statusParam = activeStatus === 'all' ? undefined : activeStatus;
  const { data, loading, error, refetch } = useApi(
    () => actionProposalsApi.list({ status: statusParam }),
    [statusParam]
  );

  const handleAction = async () => {
    if (!confirmAction) return;
    setActing(true);
    try {
      if (confirmAction.type === 'approve') {
        await actionProposalsApi.approve(confirmAction.id, 'Approved via dashboard');
      } else {
        await actionProposalsApi.reject(confirmAction.id, 'Rejected via dashboard');
      }
      await refetch();
    } finally {
      setActing(false);
      setConfirmAction(null);
    }
  };

  const pendingCount = data?.filter((p) => p.status === 'PENDING_APPROVAL').length ?? 0;

  const tabs = STATUS_FILTERS.map((f) => ({
    key: f.key,
    label: f.label,
    count: f.key === 'all' ? undefined : data?.filter((p) => p.status === f.key).length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Intelligence', href: '/intelligence' }, { label: 'Action Proposals' }]}
        title="AI Action Proposals"
        subtitle="Layer 8 Action Proposals & Human Authorization Queue"
      />

      <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
        <svg className="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <div>
          <span className="font-semibold">Human-in-the-Loop Required</span> — All AI-proposed actions must be reviewed and approved by an authorized human before execution. Approved actions will be executed automatically.
        </div>
      </div>

      {pendingCount > 0 && (
        <Card>
          <CardBody className="flex items-center gap-3 py-3">
            <Badge variant="yellow">{pendingCount} pending approval</Badge>
            <span className="text-sm text-gray-500">Actions awaiting your review</span>
          </CardBody>
        </Card>
      )}

      <Tabs tabs={tabs} active={activeStatus} onChange={setActiveStatus} />

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No action proposals" description="There are no AI action proposals matching this filter." />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Action Proposals ({data.length})</CardTitle>
              <button onClick={refetch} className="btn btn-secondary btn-sm">Refresh</button>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Action Type</th>
                    <th>Target</th>
                    <th>Reason</th>
                    <th>Confidence</th>
                    <th>Risk</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((proposal) => (
                    <tr key={proposal.id}>
                      <td>
                        <Badge variant="blue">{proposal.actionType}</Badge>
                      </td>
                      <td>
                        <div className="text-sm">
                          <span className="font-medium">{proposal.targetType}</span>
                          <span className="text-gray-400 mx-1">/</span>
                          <span className="font-mono text-xs">{proposal.targetId}</span>
                        </div>
                      </td>
                      <td>
                        <p className="text-sm text-gray-700 max-w-xs truncate" title={proposal.reason}>
                          {proposal.reason}
                        </p>
                      </td>
                      <td>
                        <span className={`text-sm font-medium ${confidenceColor(proposal.confidence)}`}>
                          {proposal.confidence}
                        </span>
                      </td>
                      <td>
                        <Badge variant={riskColor(proposal.risk)}>{proposal.risk}</Badge>
                      </td>
                      <td>
                        <Badge variant={statusColor(proposal.status)}>{proposal.status.replace('_', ' ')}</Badge>
                      </td>
                      <td>
                        <span className="text-sm text-gray-500">{formatDateTime(proposal.createdAt)}</span>
                      </td>
                      <td>
                        {proposal.status === 'PENDING_APPROVAL' && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setConfirmAction({ type: 'approve', id: proposal.id })}
                              className="px-2.5 py-1 text-xs font-medium rounded border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setConfirmAction({ type: 'reject', id: proposal.id })}
                              className="px-2.5 py-1 text-xs font-medium rounded border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {proposal.status === 'EXECUTED' && proposal.executedAt && (
                          <span className="text-xs text-green-600">Executed {formatDateTime(proposal.executedAt)}</span>
                        )}
                        {proposal.status === 'FAILED' && proposal.executionResult && (
                          <span className="text-xs text-red-600">Failed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      <ConfirmDialog
        open={confirmAction?.type === 'approve'}
        title="Approve Action"
        message={`Are you sure you want to APPROVE this action? This action will be executed once approved. This decision cannot be undone.`}
        onConfirm={handleAction}
        onCancel={() => setConfirmAction(null)}
        variant="primary"
      />

      <ConfirmDialog
        open={confirmAction?.type === 'reject'}
        title="Reject Action"
        message={`Are you sure you want to REJECT this action? This action will be declined and will not be executed.`}
        onConfirm={handleAction}
        onCancel={() => setConfirmAction(null)}
        variant="danger"
      />
    </div>
  );
}
