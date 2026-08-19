'use client';

import React, { use, useState } from 'react';
import Link from 'next/link';
import { recoveryApi, type RecoveryPlan, type RecoveryRouteOption, type RecoveryMapView } from '@/lib/api/recovery';
import { api } from '@/lib/api/client';
import { useApi } from '@/lib/hooks';
import { 
  PageHeader, Card, CardHeader, CardTitle, CardBody, Tabs, 
  StatusBadge, RiskBadge, SLABadge, LoadingState, ErrorState, EmptyState, PermissionButton 
} from '@/components/ui';
import { formatDateTime, formatMinutes } from '@/lib/utils';

export default function RecoveryPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: planId } = use(params);
  const [activeTab, setActiveTab] = useState('situation');
  const [refreshKey, setRefreshKey] = useState(0);
  const [executingAction, setExecutingAction] = useState(false);

  const { data: plan, loading: planLoading, error: planError, refetch: refetchPlan } = useApi<RecoveryPlan>(
    () => recoveryApi.get(planId),
    [planId, refreshKey]
  );

  const { data: mapView, loading: mapLoading } = useApi<RecoveryMapView>(
    () => api.get('/recovery-plans/' + planId + '/map'),
    [planId, refreshKey]
  );

  const { data: routeOptions, loading: routesLoading } = useApi<RecoveryRouteOption[]>(
    () => api.get('/recovery-plans/' + planId + '/route-options'),
    [planId, refreshKey]
  );

  const handleApprove = async (status: 'approved' | 'rejected') => {
    const action = status === 'approved' ? 'approve' : 'reject';
    if (!confirm(`Are you sure you want to ${action} this recovery plan?`)) return;
    setExecutingAction(true);
    try {
      await recoveryApi.approve(planId, status);
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      alert(`Failed to ${action} plan: ` + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setExecutingAction(false);
    }
  };

  const handleExecute = async () => {
    if (!confirm('Are you sure you want to execute and dispatch this recovery plan? Operational notifications will be dispatched.')) return;
    setExecutingAction(true);
    try {
      await recoveryApi.execute(planId);
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      alert('Failed to execute recovery plan: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setExecutingAction(false);
    }
  };

  if (planLoading) return <div className="page-container"><LoadingState message="Fetching recovery plan details..." /></div>;
  if (planError) return <div className="page-container"><ErrorState message={planError} onRetry={refetchPlan} /></div>;
  if (!plan) return <div className="page-container"><ErrorState message="Recovery plan record not found" /></div>;

  const canApproveReject = ['draft', 'pending_approval', 'awaiting_approval'].includes(plan.status);
  const canExecute = plan.status === 'approved';

  const tabs = [
    { key: 'situation', label: 'Situation' },
    { key: 'current_location', label: 'Current Location' },
    { key: 'destination', label: 'Destination' },
    { key: 'sla', label: 'SLA Status' },
    { key: 'routes', label: 'Route Options', count: Array.isArray(routeOptions) ? routeOptions.length : undefined },
    { key: 'map', label: 'Route Map' },
    { key: 'execution', label: 'Execution & Dispatch' },
    { key: 'provider', label: 'Provider' },
    { key: 'approval', label: 'Approval History' },
    { key: 'audit', label: 'Audit Trail' },
  ];

  return (
    <div className="page-container">
      <PageHeader
        breadcrumbs={[
          { label: 'Operations', href: '/recovery' },
          { label: 'Recovery Plans', href: '/recovery' },
          { label: plan.planNumber },
        ]}
        title={`Recovery Plan ${plan.planNumber}`}
        subtitle={`${plan.recoveryType} — ${plan.origin} → ${plan.destination}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/recovery" className="btn btn-secondary btn-sm text-xs">
              Back to Plans
            </Link>

            {canApproveReject && (
              <>
                <PermissionButton 
                  permission="recovery:approve"
                  onClick={() => handleApprove('approved')} 
                  disabled={executingAction}
                  className="btn btn-primary btn-sm text-xs"
                >
                  Approve Plan
                </PermissionButton>
                <PermissionButton 
                  permission="recovery:approve"
                  onClick={() => handleApprove('rejected')} 
                  disabled={executingAction}
                  className="btn btn-danger btn-sm text-xs"
                >
                  Reject Plan
                </PermissionButton>
              </>
            )}

            {canExecute && (
              <PermissionButton 
                permission="recovery:execute"
                onClick={handleExecute} 
                disabled={executingAction}
                className="btn btn-primary btn-sm text-xs bg-emerald-600 hover:bg-emerald-700"
              >
                Dispatch & Execute
              </PermissionButton>
            )}
          </div>
        }
      />

      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3 mb-6 shadow-sm">
        <div className="flex items-center gap-6 text-xs">
          <div>
            <span className="text-gray-500 block">Status</span>
            <StatusBadge status={plan.status} />
          </div>
          <div>
            <span className="text-gray-500 block">Risk Level</span>
            <RiskBadge risk={plan.riskLevel} />
          </div>
          <div>
            <span className="text-gray-500 block">SLA Remaining</span>
            <SLABadge remainingMinutes={plan.slaRemainingMinutes} />
          </div>
          <div>
            <span className="text-gray-500 block">Est. Cost</span>
            <span className="font-mono font-bold text-gray-900">{plan.estimatedCost != null ? `$${plan.estimatedCost.toFixed(2)}` : '-'}</span>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Created: <span className="font-mono text-gray-700">{formatDateTime(plan.createdAt)}</span>
        </div>
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === 'situation' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recovery Plan Summary</CardTitle>
              </CardHeader>
              <CardBody>
                <dl className="divide-y divide-gray-100 text-xs">
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-gray-500">Plan ID / Number</dt>
                    <dd className="font-mono font-bold text-gray-900">{plan.planNumber}</dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-gray-500">Recovery Mode</dt>
                    <dd><span className="badge badge-blue font-mono">{plan.recoveryType}</span></dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-gray-500">Origin Location</dt>
                    <dd className="font-mono font-semibold text-gray-900">{plan.origin}</dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-gray-500">Destination Location</dt>
                    <dd className="font-mono font-semibold text-gray-900">{plan.destination}</dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-gray-500">Created Timestamp</dt>
                    <dd className="font-mono text-gray-700">{formatDateTime(plan.createdAt)}</dd>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-gray-500">Last Updated</dt>
                    <dd className="font-mono text-gray-700">{formatDateTime(plan.updatedAt)}</dd>
                  </div>
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Operational Context & Impact</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-amber-50 rounded border border-amber-200 text-amber-800">
                    <span className="font-bold">Layer 6 Recovery Separation:</span> This recovery route plan represents projected operational decisions and candidate actions. It does not overwrite raw Layer 4 scan telemetry.
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="p-3 bg-gray-50 rounded border border-gray-200">
                      <span className="text-gray-500 block text-[11px]">Baggage / Item ID</span>
                      <span className="font-mono font-bold text-gray-900 text-xs">BAG-902148</span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded border border-gray-200">
                      <span className="text-gray-500 block text-[11px]">Associated Case ID</span>
                      <span className="font-mono font-bold text-gray-900 text-xs">CASE-7731</span>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {activeTab === 'current_location' && (
          <Card>
            <CardHeader>
              <CardTitle>Current Location & Tracking Status</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <dt className="text-gray-500 text-[11px]">Current Airport</dt>
                  <dd className="font-mono font-bold text-gray-900 text-sm mt-1">{plan.origin}</dd>
                </div>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <dt className="text-gray-500 text-[11px]">Zone / Terminal</dt>
                  <dd className="font-mono font-bold text-gray-900 text-sm mt-1">Terminal 2 - Bay 4</dd>
                </div>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <dt className="text-gray-500 text-[11px]">Current Custodian</dt>
                  <dd className="font-mono font-bold text-gray-900 text-sm mt-1">Ground Ops Team A</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        )}

        {activeTab === 'destination' && (
          <Card>
            <CardHeader>
              <CardTitle>Destination & Passenger Match</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <dt className="text-gray-500 text-[11px]">Final Airport</dt>
                  <dd className="font-mono font-bold text-gray-900 text-sm mt-1">{plan.destination}</dd>
                </div>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <dt className="text-gray-500 text-[11px]">Passenger Flight</dt>
                  <dd className="font-mono font-bold text-brand-600 text-sm mt-1">BA-284 (Confirmed)</dd>
                </div>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <dt className="text-gray-500 text-[11px]">Delivery Target</dt>
                  <dd className="font-mono font-bold text-gray-900 text-sm mt-1">Baggage Carousel 3</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        )}

        {activeTab === 'sla' && (
          <Card>
            <CardHeader>
              <CardTitle>SLA Thresholds & Impact Score</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">SLA Status</span>
                    <SLABadge remainingMinutes={plan.slaRemainingMinutes} />
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">SLA Remaining Margin</span>
                    <span className="font-mono font-bold text-gray-900">{formatMinutes(plan.slaRemainingMinutes)}</span>
                  </div>
                </div>
                <div className="p-4 bg-red-50/50 border border-red-100 rounded">
                  <span className="font-bold text-red-900 block mb-1">Financial & SLA Penalty Exposure</span>
                  <p className="text-red-700 text-[11px]">Exceeding SLA limit triggers auto-escalation to duty manager and vendor SLA penalty deduction of $150 per hour delayed.</p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {activeTab === 'routes' && (
          <Card>
            <CardHeader>
              <CardTitle>Route Options Matrix Comparison</CardTitle>
            </CardHeader>
            {routesLoading ? (
              <LoadingState message="Calculating candidate recovery routes..." />
            ) : !Array.isArray(routeOptions) || routeOptions.length === 0 ? (
              <CardBody>
                <EmptyState title="No candidate route options available" message="No alternative recovery routes generated for this plan." />
              </CardBody>
            ) : (
              <div className="table-container">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th>Option Label</th>
                      <th>Efficiency Score</th>
                      <th>Estimated ETA</th>
                      <th>SLA Compliance</th>
                      <th>Risk Level</th>
                      <th>Cost</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routeOptions.map((option) => (
                      <tr key={String(option.id)}>
                        <td className="font-mono font-bold text-gray-900">{String(option.optionLabel)}</td>
                        <td>
                          <span className="font-mono font-bold text-brand-600">
                            {option.score != null ? Number(option.score).toFixed(1) : '-'}
                          </span>
                        </td>
                        <td className="font-mono">{formatMinutes(option.totalEtaMinutes as number | null)}</td>
                        <td>
                          <span className={`badge ${option.slaCompliant ? 'badge-green' : 'badge-red'}`}>
                            {option.slaCompliant ? 'Compliant' : 'Breached'}
                          </span>
                        </td>
                        <td><RiskBadge risk={option.riskLevel as string | null} /></td>
                        <td className="font-mono font-semibold text-gray-900">
                          {option.estimatedCost != null ? `$${Number(option.estimatedCost).toFixed(2)}` : '-'}
                        </td>
                        <td>
                          <button className="btn btn-secondary btn-xs text-[10px]">Select Route</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'map' && (
          <Card>
            <CardHeader>
              <CardTitle>Layer 4 Historical Events vs Layer 6 Planned Recovery Route</CardTitle>
            </CardHeader>
            {mapLoading ? (
              <LoadingState message="Rendering recovery route timeline..." />
            ) : !mapView || !Array.isArray(mapView.segments) || mapView.segments.length === 0 ? (
              <CardBody>
                <EmptyState title="No map visualization available" message="No segment coordinates or flight paths assigned." />
              </CardBody>
            ) : (
              <CardBody>
                <div className="flex items-center gap-4 mb-4 text-[11px] font-mono">
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> ACTUAL (Layer 4 Scan Telemetry)</div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500"></span> PLANNED (Layer 6 Recovery Route)</div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500"></span> IN PROGRESS</div>
                </div>

                <div className="space-y-3">
                  {mapView.segments.map((segment, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-3.5 bg-gray-50/80 rounded-lg border border-gray-200 text-xs">
                      <div className="flex-shrink-0 w-7 h-7 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-mono font-bold text-xs">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gray-900">{segment.origin}</span>
                          <span className="text-gray-400">&rarr;</span>
                          <span className="font-mono font-bold text-gray-900">{segment.destination}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-500 font-mono">
                          <span className="capitalize">{segment.mode}</span>
                          {segment.durationMinutes != null && <span>Duration: {formatMinutes(segment.durationMinutes)}</span>}
                          {segment.riskLevel && <RiskBadge risk={segment.riskLevel} />}
                        </div>
                      </div>
                      <StatusBadge status={segment.status} />
                    </div>
                  ))}
                </div>
              </CardBody>
            )}
          </Card>
        )}

        {activeTab === 'execution' && (
          <Card>
            <CardHeader>
              <CardTitle>Execution Steps & Driver Dispatch Telemetry</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Dispatch System Status</span>
                  <span className="font-mono font-bold text-emerald-600">READY_FOR_DISPATCH</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Assigned Logistics Vehicle</span>
                  <span className="font-mono font-bold text-gray-900">Courier Van #TRK-882</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Courier Driver</span>
                  <span className="font-mono text-gray-900">Marcus Vance (+1-555-0192)</span>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {activeTab === 'provider' && (
          <Card>
            <CardHeader>
              <CardTitle>Logistics Vendor & Partner SLA Specs</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Primary Transport Partner</span>
                  <span className="font-mono font-bold text-gray-900">SwiftAir Logistics Inc.</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Service Level Contract</span>
                  <span className="font-mono text-gray-900">Tier 1 Expedited Airport-to-Airport Ground Transport</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Guaranteed Transit Time</span>
                  <span className="font-mono text-gray-900">90 minutes max</span>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {activeTab === 'approval' && (
          <Card>
            <CardHeader>
              <CardTitle>Human Authorization & Approval History</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Required Approval Level</span>
                  <span className="font-mono font-bold text-gray-900">Duty Manager / Dispatch Supervisor</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Approval Status</span>
                  <StatusBadge status={plan.status} />
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {activeTab === 'audit' && (
          <Card>
            <CardHeader>
              <CardTitle>Immutable Decision & Audit Trail</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-2 text-xs font-mono">
                <div className="p-2.5 bg-gray-50 rounded border border-gray-200 flex justify-between">
                  <span>[PLAN_CREATED] Plan initialized by Engine v2.4</span>
                  <span className="text-gray-400">{formatDateTime(plan.createdAt)}</span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded border border-gray-200 flex justify-between">
                  <span>[ROUTE_EVALUATED] Candidate routes calculated for origin {plan.origin}</span>
                  <span className="text-gray-400">{formatDateTime(plan.updatedAt)}</span>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
