'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/hooks';
import { baggageApi, type BaggageDetailView, type BaggageTimelineEntry } from '@/lib/api/baggage';
import { PageHeader, Card, CardHeader, CardTitle, CardBody, Tabs, StatusBadge, PriorityBadge, LoadingState, ErrorState, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

const DETAIL_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'journey', label: 'Journey' },
  { key: 'live_location', label: 'Live Location' },
  { key: 'timeline', label: 'Event Timeline' },
  { key: 'custody', label: 'Custody' },
  { key: 'case', label: 'Case' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'sla', label: 'SLA' },
  { key: 'intelligence', label: 'Intelligence' },
  { key: 'audit', label: 'Audit' },
];

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-b-0 text-xs">
      <span className="text-gray-500 font-medium">{label}</span>
      <span className="font-semibold text-gray-900">{value ?? '-'}</span>
    </div>
  );
}

function OverviewTab({ detail }: { detail: BaggageDetailView }) {
  const baggage = detail.baggage;
  const state = detail.state;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Baggage Identity & Specification</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-0">
              <InfoRow label="Baggage Tag ID" value={<span className="font-mono text-xs font-bold text-brand-600">{baggage.tagNumber}</span>} />
              <InfoRow label="Passenger Name" value={baggage.passengerName} />
              <InfoRow label="Passenger Ref / PNR" value={<span className="font-mono text-xs">{baggage.passengerReference}</span>} />
              <InfoRow label="Priority Class" value={<PriorityBadge priority={baggage.priority} />} />
              <InfoRow label="Operational Status" value={<StatusBadge status={baggage.status} />} />
              <InfoRow label="Weight" value={baggage.weight != null ? `${baggage.weight} kg` : '-'} />
              <InfoRow label="Dimensions" value={baggage.dimensions} />
              <InfoRow label="Bag Type" value={baggage.bagType} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Operational State</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-0">
              <InfoRow label="Current State" value={<StatusBadge status={state.currentState} />} />
              <InfoRow label="Current Location" value={state.currentLocation} />
              <InfoRow label="Airport Code" value={<span className="font-mono font-bold">{state.currentAirportCode}</span>} />
              <InfoRow label="Current Custodian" value={state.currentCustodian} />
              <InfoRow label="Custodian Type" value={state.currentCustodianType} />
              <InfoRow label="Event Sequence #" value={state.sequenceNumber} />
              <InfoRow label="Total Events Logged" value={state.eventCount} />
              <InfoRow label="Expected Next Event" value={state.expectedNextEvent} />
            </div>
          </CardBody>
        </Card>
      </div>

      {detail.recentExceptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-700">Active Operational Exceptions</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-2">
              {detail.recentExceptions.map((exc, i) => (
                <div key={i} className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-900">
                  {typeof exc === 'object' ? JSON.stringify(exc) : String(exc)}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function JourneyTab({ detail }: { detail: BaggageDetailView }) {
  const journey = detail.journey;
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Passenger & Baggage Journey Path</CardTitle>
        <span className="text-xs text-gray-500 font-mono">DISTINGUISHING ACTUAL EVENTS FROM PLANNED RECOVERY</span>
      </CardHeader>
      <CardBody>
        {!journey ? (
          <EmptyState title="No Journey Associated" message="No flight journey itinerary has been linked to this baggage tag." />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg text-xs">
              <div>
                <span className="text-gray-500 block">Origin Airport</span>
                <span className="font-mono font-bold text-gray-900 text-sm">{journey.originAirportId ?? 'Unknown'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Final Destination</span>
                <span className="font-mono font-bold text-gray-900 text-sm">{journey.destinationAirportId ?? 'Unknown'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Journey Status</span>
                <StatusBadge status={journey.status} />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Flight Segments</h4>
              {journey.flightSegments.map((seg, i) => (
                <div key={i} className="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 font-mono font-bold text-xs">
                      {seg.flightNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
                        <span>{seg.departureAirportId}</span>
                        <span className="text-gray-400">&rarr;</span>
                        <span>{seg.arrivalAirportId}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Dep: {seg.scheduledDeparture ? formatDateTime(seg.scheduledDeparture) : '-'} | Arr: {seg.scheduledArrival ? formatDateTime(seg.scheduledArrival) : '-'}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={seg.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function LiveLocationTab({ detail }: { detail: BaggageDetailView }) {
  const state = detail.state;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Location & Custody Marker</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="p-6 bg-slate-900 text-white rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">Current Terminal / Area</p>
              <p className="text-xl font-bold text-brand-400 mt-0.5">{state.currentLocation ?? 'Scanning Area'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase font-semibold">Airport Code</p>
              <p className="text-xl font-mono font-bold text-white mt-0.5">{state.currentAirportCode ?? 'N/A'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-slate-400">Current Custodian</p>
              <p className="font-semibold text-white mt-0.5">{state.currentCustodian ?? 'Unassigned'}</p>
            </div>
            <div>
              <p className="text-slate-400">Last Scanned Event</p>
              <p className="font-semibold text-white mt-0.5">{state.lastEventAt ? formatDateTime(state.lastEventAt) : 'N/A'}</p>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function TimelineTab({ timelineData }: { timelineData: BaggageTimelineEntry[] | undefined }) {
  if (!timelineData || timelineData.length === 0) {
    return <EmptyState title="No Event Timeline Available" message="No operational scans or events have been logged for this baggage." />;
  }

  return (
    <div className="space-y-3">
      {timelineData.map((event) => (
        <Card key={event.eventId}>
          <CardBody>
            <div className="flex items-start justify-between text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-gray-900">{event.eventType.toUpperCase()}</span>
                  <StatusBadge status={event.status} />
                  {event.isCorrection && <span className="badge badge-yellow text-[10px]">CORRECTION</span>}
                </div>
                <p className="text-gray-500">{formatDateTime(event.occurredAt)}</p>
              </div>
              <div className="text-right text-gray-600">
                <p className="font-medium">{event.location ?? 'Unknown location'}</p>
                {event.airportCode && <p className="font-mono font-semibold text-gray-800">{event.airportCode}</p>}
                <p className="text-[10px] text-gray-400">Handler: {event.handler ?? 'Auto'}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function CustodyTab({ detail }: { detail: BaggageDetailView }) {
  const custody = detail.custody;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Custody Chain Integrity</CardTitle>
      </CardHeader>
      <CardBody>
        {!custody ? (
          <EmptyState title="No Custody Records" message="No chain of custody logs available." />
        ) : (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-bold text-gray-900 mb-2">Active Custodian</h4>
              <p className="font-mono text-gray-700">{JSON.stringify(custody.currentCustody, null, 2)}</p>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-2">Custody Handoff History</h4>
              <div className="divide-y border rounded-lg overflow-hidden">
                {custody.custodyHistory.map((c, i) => (
                  <div key={i} className="p-3 bg-white hover:bg-gray-50">
                    <p className="font-mono text-gray-700">{typeof c === 'object' ? JSON.stringify(c) : String(c)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function BaggageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState('overview');

  const { data: detail, loading: detailLoading, error: detailError, refetch: refetchDetail } = useApi(
    () => baggageApi.getDetail(id),
    [id]
  );
  const { data: timelineData, loading: timelineLoading, error: timelineError, refetch: refetchTimeline } = useApi(
    () => baggageApi.getTimeline(id),
    [id]
  );

  const loading = detailLoading || timelineLoading;
  const error = detailError || timelineError;

  if (loading) return <LoadingState message="Fetching baggage detail workspace..." />;
  if (error) return <ErrorState message={error} onRetry={() => { refetchDetail(); refetchTimeline(); }} />;
  if (!detail) return <EmptyState title="Baggage Not Found" message="The requested baggage ID could not be found." />;

  return (
    <div className="page-container">
      <PageHeader
        breadcrumbs={[
          { label: 'Operations', href: '/baggage' },
          { label: 'Baggage', href: '/baggage' },
          { label: detail.baggage.tagNumber },
        ]}
        title={`Baggage: ${detail.baggage.tagNumber}`}
        subtitle={`Passenger: ${detail.baggage.passengerName ?? 'Unknown'} | Ref: ${detail.baggage.passengerReference ?? 'N/A'}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/cases?baggageId=${detail.baggage.id}`} className="btn btn-secondary btn-sm">
              View / Create Case
            </Link>
            <Link href={`/recovery?baggageId=${detail.baggage.id}`} className="btn btn-primary btn-sm">
              View Recovery Workspace
            </Link>
          </div>
        }
      />

      <div className="flex items-center gap-3 mb-6">
        <StatusBadge status={detail.baggage.status} />
        <PriorityBadge priority={detail.baggage.priority} />
        <span className="text-xs text-gray-500 font-mono">Location: {detail.state.currentLocation ?? 'Unknown'}</span>
      </div>

      <Tabs tabs={DETAIL_TABS} active={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === 'overview' && <OverviewTab detail={detail} />}
        {activeTab === 'journey' && <JourneyTab detail={detail} />}
        {activeTab === 'live_location' && <LiveLocationTab detail={detail} />}
        {activeTab === 'timeline' && <TimelineTab timelineData={timelineData?.timeline} />}
        {activeTab === 'custody' && <CustodyTab detail={detail} />}
        {activeTab === 'case' && (
          <Card>
            <CardBody>
              <div className="p-6 text-center">
                <h3 className="text-sm font-semibold text-gray-900">Linked Case Operations</h3>
                <p className="text-xs text-gray-500 mt-1">Manage cases and SLAs linked to baggage {detail.baggage.tagNumber}</p>
                <Link href={`/cases?baggageId=${detail.baggage.id}`} className="btn btn-primary btn-sm mt-4">
                  Open Case Operations
                </Link>
              </div>
            </CardBody>
          </Card>
        )}
        {activeTab === 'recovery' && (
          <Card>
            <CardBody>
              <div className="p-6 text-center">
                <h3 className="text-sm font-semibold text-gray-900">Recovery Planning & Execution</h3>
                <p className="text-xs text-gray-500 mt-1">Explore route options and execute recovery plans for this baggage.</p>
                <Link href={`/recovery?baggageId=${detail.baggage.id}`} className="btn btn-primary btn-sm mt-4">
                  Open Recovery Command Center
                </Link>
              </div>
            </CardBody>
          </Card>
        )}
        {activeTab === 'sla' && (
          <Card>
            <CardBody>
              <div className="p-6 text-center">
                <h3 className="text-sm font-semibold text-gray-900">SLA Health & Escalations</h3>
                <p className="text-xs text-gray-500 mt-1">Track SLA deadlines and resolution targets.</p>
                <Link href="/cases" className="btn btn-secondary btn-sm mt-4">
                  View SLA Escalations Queue
                </Link>
              </div>
            </CardBody>
          </Card>
        )}
        {activeTab === 'intelligence' && (
          <Card>
            <CardBody>
              <div className="p-6 text-center">
                <h3 className="text-sm font-semibold text-gray-900">Layer 8 Intelligence Analysis</h3>
                <p className="text-xs text-gray-500 mt-1">Root cause analysis, anomaly detection, and predictive insights.</p>
                <Link href="/intelligence" className="btn btn-primary btn-sm mt-4">
                  Open Intelligence Center
                </Link>
              </div>
            </CardBody>
          </Card>
        )}
        {activeTab === 'audit' && (
          <Card>
            <CardBody>
              <div className="p-6 text-center">
                <h3 className="text-sm font-semibold text-gray-900">Audit Logs & Governance</h3>
                <p className="text-xs text-gray-500 mt-1">Full immutable event audit history for regulatory compliance.</p>
                <Link href="/audit" className="btn btn-secondary btn-sm mt-4">
                  Open Audit Log Workspace
                </Link>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
