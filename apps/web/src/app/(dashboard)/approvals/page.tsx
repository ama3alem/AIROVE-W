'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import { actionProposalsApi, type AIActionProposal } from '@/lib/api/action-proposals';
import { PageHeader, Card, CardHeader, CardTitle, CardBody, Badge, Tabs, ConfirmDialog } from '@/components/ui';
import { LoadingSpinner, ErrorState, EmptyState, formatDateTime, confidenceColor } from '@/lib/utils';

function riskColor(risk: string) {
  switch (risk) {
    case 'HIGH': return 'red' as const;
    case 'MEDIUM': return 'yellow' as const;
    case 'LOW': return 'blue' as const;
    default: return 'gray' as const;
  }
}

function FlowDiagram() {
  return (
    <div className="flex items-center justify-center gap-2 text-sm py-4">
      <div className="flex items-center gap-2 rounded-md border bg-purple-50 border-purple-200 px-3 py-2">
        <svg className="h-4 w-4 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
        </svg>
        <span className="font-medium text-purple-800">AI Recommendation</span>
      </div>
      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
      <div className="flex items-center gap-2 rounded-md border bg-blue-50 border-blue-200 px-3 py-2">
        <span className="font-medium text-blue-800">Action Proposal</span>
      </div>
      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
      <div className="flex items-center gap-2 rounded-md border bg-amber-50 border-amber-200 px-3 py-2">
        <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
        </svg>
        <span className="font-medium text-amber-800">Human Approval</span>
      </div>
      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
      <div className="flex items-center gap-2 rounded-md border bg-green-50 border-green-200 px-3 py-2">
        <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        </svg>
        <span className="font-medium text-green-800">Authorized Execution</span>
      </div>
    </div>
  );
}

function PendingApprovalCard({
  proposal,
  onApprove,
  onReject,
}: {
  proposal: AIActionProposal;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="yellow">Pending Approval</Badge>
            <Badge variant={riskColor(proposal.risk)}>Risk: {proposal.risk}</Badge>
            <span className="text-xs text-gray-400">Created {formatDateTime(proposal.createdAt)}</span>
          </div>
          <Badge variant="gray">{proposal.id.slice(0, 8)}</Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Action</p>
            <p className="font-medium">{proposal.actionType}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Target</p>
            <p className="font-medium">{proposal.targetType}: <span className="font-mono text-xs">{proposal.targetId}</span></p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Confidence</p>
            <p className={`font-medium ${confidenceColor(proposal.confidence)}`}>{proposal.confidence}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Required Permission</p>
            <p className="font-medium">{proposal.requiredApproval}</p>
          </div>
        </div>

        <div className="rounded-md bg-gray-50 border p-3">
          <p className="text-xs font-medium text-gray-500 mb-1">Reason</p>
          <p className="text-sm text-gray-700">{proposal.reason}</p>
        </div>

        {proposal.evidence && proposal.evidence.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <svg className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              Evidence ({proposal.evidence.length} sources)
            </button>
            {expanded && (
              <div className="mt-2 space-y-1">
                {proposal.evidence.map((e, i) => (
                  <div key={i} className="rounded border p-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        e.evidenceType === 'FACT' ? 'green' :
                        e.evidenceType === 'INFERENCE' ? 'yellow' : 'blue'
                      }>{e.evidenceType}</Badge>
                      <span className="text-gray-400">{e.sourceLayer} / {e.sourceType}</span>
                    </div>
                    <p className="text-gray-700 mt-1">{e.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2 border-t">
          <button
            onClick={onApprove}
            className="px-4 py-2 text-sm font-medium rounded-md border border-green-300 bg-green-50 text-green-800 hover:bg-green-100 transition-colors"
          >
            Approve & Execute
          </button>
          <button
            onClick={onReject}
            className="px-4 py-2 text-sm font-medium rounded-md border border-red-300 bg-red-50 text-red-800 hover:bg-red-100 transition-colors"
          >
            Reject
          </button>
        </div>
      </CardBody>
    </Card>
  );
}

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState('pending');
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'reject'; id: string } | null>(null);

  const { data: pendingData, loading: pendingLoading, error: pendingError, refetch: refetchPending } = useApi(
    () => actionProposalsApi.list({ status: 'PENDING_APPROVAL' }), []
  );

  const { data: historyData, loading: historyLoading, error: historyError, refetch: refetchHistory } = useApi(
    () => actionProposalsApi.list(), []
  );

  const handleAction = async () => {
    if (!confirmAction) return;
    try {
      if (confirmAction.type === 'approve') {
        await actionProposalsApi.approve(confirmAction.id, 'Approved via approvals dashboard');
      } else {
        await actionProposalsApi.reject(confirmAction.id, 'Rejected via approvals dashboard');
      }
      await refetchPending();
      await refetchHistory();
    } finally {
      setConfirmAction(null);
    }
  };

  const tabs = [
    { key: 'pending', label: 'Pending Approvals', count: pendingData?.length },
    { key: 'history', label: 'Approval History' },
  ];

  const approvalHistory = historyData?.filter(
    (p) => ['APPROVED', 'REJECTED', 'EXECUTED', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(p.status)
  ) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Intelligence', href: '/intelligence' }, { label: 'Approvals' }]}
        title="Human Approvals Queue"
        subtitle="Layer 8 Governance & Human Approval Decision Gate"
      />

      <FlowDiagram />

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'pending' && (
        <>
          {pendingLoading ? (
            <LoadingSpinner />
          ) : pendingError ? (
            <ErrorState message={pendingError} onRetry={refetchPending} />
          ) : !pendingData || pendingData.length === 0 ? (
            <EmptyState title="No pending approvals" description="All AI action proposals have been reviewed." />
          ) : (
            <div className="space-y-4">
              {pendingData.map((proposal) => (
                <PendingApprovalCard
                  key={proposal.id}
                  proposal={proposal}
                  onApprove={() => setConfirmAction({ type: 'approve', id: proposal.id })}
                  onReject={() => setConfirmAction({ type: 'reject', id: proposal.id })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <>
          {historyLoading ? (
            <LoadingSpinner />
          ) : historyError ? (
            <ErrorState message={historyError} onRetry={refetchHistory} />
          ) : approvalHistory.length === 0 ? (
            <EmptyState title="No approval history" description="No proposals have been reviewed yet." />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Approval History ({approvalHistory.length})</CardTitle>
              </CardHeader>
              <CardBody className="p-0">
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Target</th>
                        <th>Risk</th>
                        <th>Status</th>
                        <th>Confidence</th>
                        <th>Created</th>
                        <th>Executed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvalHistory.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <Badge variant="blue">{p.actionType}</Badge>
                          </td>
                          <td>
                            <span className="text-sm font-medium">{p.targetType}</span>
                          </td>
                          <td>
                            <Badge variant={riskColor(p.risk)}>{p.risk}</Badge>
                          </td>
                          <td>
                            <Badge variant={
                              p.status === 'APPROVED' || p.status === 'EXECUTED' ? 'green' :
                              p.status === 'REJECTED' || p.status === 'FAILED' ? 'red' : 'gray'
                            }>{p.status.replace('_', ' ')}</Badge>
                          </td>
                          <td>
                            <span className={`text-sm ${confidenceColor(p.confidence)}`}>{p.confidence}</span>
                          </td>
                          <td>
                            <span className="text-sm text-gray-500">{formatDateTime(p.createdAt)}</span>
                          </td>
                          <td>
                            <span className="text-sm text-gray-500">{p.executedAt ? formatDateTime(p.executedAt) : '—'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmAction?.type === 'approve'}
        title="Approve Action"
        message="Are you sure you want to APPROVE this action? This action will be executed once approved. This decision cannot be undone."
        onConfirm={handleAction}
        onCancel={() => setConfirmAction(null)}
        variant="primary"
      />

      <ConfirmDialog
        open={confirmAction?.type === 'reject'}
        title="Reject Action"
        message="Are you sure you want to REJECT this action? This action will be declined and will not be executed."
        onConfirm={handleAction}
        onCancel={() => setConfirmAction(null)}
        variant="danger"
      />
    </div>
  );
}
