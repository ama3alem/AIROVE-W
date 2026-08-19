'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/hooks';
import { casesApi, type CaseDetailView } from '@/lib/api/cases';
import { PageHeader, Card, CardHeader, CardTitle, CardBody, Tabs, ConfirmDialog, StatusBadge, PriorityBadge, LoadingState, ErrorState, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: detail, loading, error, refetch } = useApi<CaseDetailView>(() => casesApi.getDetail(id), [id]);
  const { data: timeline, loading: timelineLoading } = useApi(() => casesApi.getTimeline(id), [id]);

  const [activeTab, setActiveTab] = useState('overview');
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');

  if (loading) return <LoadingState message="Loading case detail workspace..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!detail) return <EmptyState title="Case Not Found" message="The requested case record could not be found." />;

  const { case: c, tasks, sla, escalations } = detail;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'baggage', label: 'Baggage' },
    { key: 'timeline', label: 'Timeline', count: timeline?.length ?? 0 },
    { key: 'tasks', label: 'Tasks', count: tasks.length },
    { key: 'sla', label: 'SLA' },
    { key: 'escalations', label: 'Escalations', count: escalations.length },
    { key: 'recovery', label: 'Recovery' },
    { key: 'intelligence', label: 'Intelligence' },
    { key: 'activity', label: 'Activity' },
    { key: 'audit', label: 'Audit' },
  ];

  const handleAction = async (action: string) => {
    try {
      if (action === 'resolve') {
        await casesApi.resolve(id, { resolution });
        setResolution('');
      } else if (action === 'close') {
        await casesApi.close(id);
      } else if (action === 'reopen') {
        await casesApi.reopen(id);
      } else if (action === 'escalate') {
        await casesApi.escalate(id);
      }
      setConfirmAction(null);
      refetch();
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  const canResolve = c.status !== 'resolved' && c.status !== 'closed';
  const canClose = c.status === 'resolved';
  const canReopen = c.status === 'resolved' || c.status === 'closed';
  const canEscalate = c.status !== 'closed';

  return (
    <div className="page-container">
      <PageHeader
        breadcrumbs={[
          { label: 'Operations', href: '/cases' },
          { label: 'Cases', href: '/cases' },
          { label: c.caseNumber },
        ]}
        title={`Case ${c.caseNumber}: ${c.title || 'Baggage Exception'}`}
        subtitle={`Type: ${c.caseType} | Assigned: ${c.assignedTo || 'Unassigned'}`}
        actions={
          <div className="flex items-center gap-2">
            {c.baggageId && (
              <Link href={`/baggage/${c.baggageId}`} className="btn btn-secondary btn-sm">
                View Baggage
              </Link>
            )}
            <Link href={`/recovery?caseId=${c.id}`} className="btn btn-primary btn-sm">
              Recovery Plan
            </Link>
          </div>
        }
      />

      <div className="flex items-center gap-3 mb-6">
        <StatusBadge status={c.status} />
        <PriorityBadge priority={c.priority} />
        <span className="text-xs text-gray-500 font-mono">Source: {c.source}</span>
      </div>

      <div className="mb-6">
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Case Metadata</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Status</dt>
                  <dd><StatusBadge status={c.status} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Priority</dt>
                  <dd><PriorityBadge priority={c.priority} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Case Type</dt>
                  <dd className="font-semibold text-gray-900">{c.caseType}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Source</dt>
                  <dd className="font-mono text-gray-700">{c.source}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Created</dt>
                  <dd>{formatDateTime(c.createdAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Updated</dt>
                  <dd>{formatDateTime(c.updatedAt)}</dd>
                </div>
                {c.description && (
                  <div className="border-t border-gray-100 pt-3">
                    <dt className="text-gray-500 mb-1">Description</dt>
                    <dd className="text-gray-900 font-normal">{c.description}</dd>
                  </div>
                )}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team Assignment & Ownership</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Assigned Agent</dt>
                  <dd className="font-semibold text-gray-900">{c.assignedTo || 'Unassigned'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Assigned Organization</dt>
                  <dd className="font-mono">{c.assignedOrganizationId || 'Current Org'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Resolution Summary</dt>
                  <dd>{c.resolution || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Resolution Code</dt>
                  <dd className="font-mono">{c.resolutionCode || '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Resolved Timestamp</dt>
                  <dd>{c.resolvedAt ? formatDateTime(c.resolvedAt) : '-'}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SLA Health Overview</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-gray-500">SLA Status</dt>
                  <dd>
                    {sla ? (
                      <StatusBadge status={sla.status} />
                    ) : (
                      <span className="text-gray-400">No SLA Target</span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Initial Response Target</dt>
                  <dd>{sla ? formatDateTime(sla.responseDueAt) : '-'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Resolution Target</dt>
                  <dd>{sla ? formatDateTime(sla.resolutionDueAt) : '-'}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === 'baggage' && (
        <Card>
          <CardHeader>
            <CardTitle>Associated Baggage Identity</CardTitle>
          </CardHeader>
          <CardBody>
            {c.baggageId ? (
              <div className="p-4 bg-gray-50 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <p className="text-gray-500">Baggage ID</p>
                  <p className="font-mono font-bold text-brand-600 text-sm">{c.baggageId}</p>
                </div>
                <Link href={`/baggage/${c.baggageId}`} className="btn btn-primary btn-sm">
                  View Full Baggage Workspace
                </Link>
              </div>
            ) : (
              <EmptyState title="No Baggage Linked" message="This case was created without an associated baggage tag." />
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'tasks' && (
        <Card>
          <CardHeader>
            <CardTitle>Actionable Tasks</CardTitle>
          </CardHeader>
          <CardBody>
            {tasks.length === 0 ? (
              <EmptyState title="No Case Tasks" message="No pending tasks assigned for this case." />
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-4 text-xs">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{task.title}</p>
                      <div className="mt-1 flex items-center gap-3 text-gray-500">
                        <span>Assigned: {task.assignedTo || 'Unassigned'}</span>
                        <span>Due: {task.dueAt ? formatDateTime(task.dueAt) : 'N/A'}</span>
                      </div>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'timeline' && (
        <Card>
          <CardHeader>
            <CardTitle>Case Activity Timeline</CardTitle>
          </CardHeader>
          <CardBody>
            {timelineLoading ? (
              <LoadingState message="Loading timeline events..." />
            ) : !timeline || timeline.length === 0 ? (
              <EmptyState title="No Timeline Logged" message="No history entries available." />
            ) : (
              <div className="space-y-4">
                {timeline.map((entry) => (
                  <div key={entry.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-brand-600" />
                      <div className="w-px flex-1 bg-gray-200" />
                    </div>
                    <div className="pb-4 text-xs">
                      <p className="font-semibold text-gray-900">{entry.description || entry.type}</p>
                      <div className="mt-1 flex items-center gap-3 text-gray-500">
                        {entry.actorId && <span>Actor: {entry.actorId}</span>}
                        <span>{formatDateTime(entry.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'sla' && (
        <Card>
          <CardHeader>
            <CardTitle>Service Level Agreement Performance</CardTitle>
          </CardHeader>
          <CardBody>
            {!sla ? (
              <EmptyState title="No SLA Target" message="No SLA rules apply to this case." />
            ) : (
              <dl className="space-y-4 text-xs">
                <div className="flex justify-between border-b border-gray-100 pb-3">
                  <dt className="text-gray-500">Current SLA Status</dt>
                  <dd><StatusBadge status={sla.status} /></dd>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-3">
                  <dt className="text-gray-500">Response Deadline</dt>
                  <dd>{formatDateTime(sla.responseDueAt)}</dd>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-3">
                  <dt className="text-gray-500">Resolution Deadline</dt>
                  <dd>{formatDateTime(sla.resolutionDueAt)}</dd>
                </div>
              </dl>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'escalations' && (
        <Card>
          <CardHeader>
            <CardTitle>Case Escalation Log</CardTitle>
          </CardHeader>
          <CardBody>
            {escalations.length === 0 ? (
              <EmptyState title="No Escalations Triggered" message="This case has not been escalated." />
            ) : (
              <div className="space-y-3">
                {escalations.map((esc) => (
                  <div key={esc.id} className="rounded-lg border border-red-100 bg-red-50/50 p-4 text-xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-red-900">{esc.reason || 'SLA Threshold Breach'}</p>
                        <div className="mt-1 flex items-center gap-3 text-red-700">
                          <span>Level: {esc.escalationLevel}</span>
                          <span>Triggered: {formatDateTime(esc.triggeredAt)}</span>
                        </div>
                      </div>
                      <StatusBadge status={esc.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'recovery' && (
        <Card>
          <CardBody>
            <div className="p-6 text-center">
              <h3 className="text-sm font-semibold text-gray-900">Recovery Planning Workspace</h3>
              <p className="text-xs text-gray-500 mt-1">Design and select recovery route options for this case.</p>
              <Link href={`/recovery?caseId=${c.id}`} className="btn btn-primary btn-sm mt-4">
                Open Recovery Command Center
              </Link>
            </div>
          </CardBody>
        </Card>
      )}

      {activeTab === 'intelligence' && (
        <Card>
          <CardBody>
            <div className="p-6 text-center">
              <h3 className="text-sm font-semibold text-gray-900">AI Intelligence Insights</h3>
              <p className="text-xs text-gray-500 mt-1">Layer 8 predictions and root cause analysis.</p>
              <Link href="/intelligence" className="btn btn-primary btn-sm mt-4">
                Open Intelligence Surface
              </Link>
            </div>
          </CardBody>
        </Card>
      )}

      {activeTab === 'activity' && (
        <Card>
          <CardHeader>
            <CardTitle>Case Activity Log</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-xs text-gray-500">Activity updates logged by operators and automation services.</p>
          </CardBody>
        </Card>
      )}

      {activeTab === 'audit' && (
        <Card>
          <CardHeader>
            <CardTitle>Governance & Compliance Audit</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-xs text-gray-500">Immutable governance record for case modifications.</p>
          </CardBody>
        </Card>
      )}

      <div className="mt-6 flex items-center gap-3">
        {canEscalate && (
          <button onClick={() => setConfirmAction('escalate')} className="btn btn-danger btn-sm">
            Escalate Case
          </button>
        )}
        {canResolve && (
          <button onClick={() => setConfirmAction('resolve')} className="btn btn-primary btn-sm">
            Resolve Case
          </button>
        )}
        {canClose && (
          <button onClick={() => setConfirmAction('close')} className="btn btn-secondary btn-sm">
            Close Case
          </button>
        )}
        {canReopen && (
          <button onClick={() => setConfirmAction('reopen')} className="btn btn-secondary btn-sm">
            Reopen Case
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmAction === 'escalate'}
        title="Escalate Case"
        message="Are you sure you want to escalate this case?"
        onConfirm={() => handleAction('escalate')}
        onCancel={() => setConfirmAction(null)}
        variant="danger"
      />

      <ConfirmDialog
        open={confirmAction === 'close'}
        title="Close Case"
        message="Are you sure you want to close this resolved case?"
        onConfirm={() => handleAction('close')}
        onCancel={() => setConfirmAction(null)}
        variant="danger"
      />

      <ConfirmDialog
        open={confirmAction === 'reopen'}
        title="Reopen Case"
        message="Are you sure you want to reopen this case?"
        onConfirm={() => handleAction('reopen')}
        onCancel={() => setConfirmAction(null)}
        variant="primary"
      />

      {confirmAction === 'resolve' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900">Resolve Case</h3>
            <p className="mt-2 text-sm text-gray-600">Provide resolution summary for this case.</p>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              rows={3}
              placeholder="Resolution details..."
            />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => { setConfirmAction(null); setResolution(''); }} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button
                onClick={() => handleAction('resolve')}
                disabled={!resolution.trim()}
                className="btn btn-primary btn-sm disabled:opacity-50"
              >
                Confirm Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
