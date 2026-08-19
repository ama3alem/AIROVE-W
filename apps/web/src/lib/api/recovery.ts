import { api, type PaginatedData, type PaginationParams } from './client';

export interface RecoveryPlan {
  id: string;
  orgId: string;
  caseId: string;
  baggageId: string | null;
  planNumber: string;
  recoveryType: string;
  status: string;
  origin: string;
  destination: string;
  currentLocation: string | null;
  slaRemainingMinutes: number | null;
  selectedRouteOptionId: string | null;
  approvalLevel: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  riskLevel: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecoveryRouteOption {
  id: string;
  recoveryPlanId: string;
  optionLabel: string;
  status: string;
  totalEtaMinutes: number | null;
  totalDistance: number | null;
  segmentCount: number;
  riskLevel: string;
  slaCompliant: boolean;
  slaMarginMinutes: number | null;
  estimatedCost: number | null;
  score: number | null;
  scoreBreakdown: string | null;
  rejectionReason: string | null;
  createdAt: Date;
}

export interface RecoveryRouteSegment {
  id: string;
  routeOptionId: string;
  segmentOrder: number;
  origin: string;
  destination: string;
  mode: string;
  carrier: string | null;
  flightNumber: string | null;
  scheduledDeparture: Date | null;
  scheduledArrival: Date | null;
  estimatedDeparture: Date | null;
  estimatedArrival: Date | null;
  durationMinutes: number | null;
  status: string;
  cost: number | null;
  riskLevel: string | null;
  notes: string | null;
}

export interface RecoveryPlanVersion {
  id: string;
  recoveryPlanId: string;
  versionNumber: number;
  routeOptionId: string;
  changeReason: string;
  snapshot: string;
  createdBy: string | null;
  createdAt: Date;
}

export interface RecoveryMapView {
  planId: string;
  planNumber: string;
  status: string;
  baggageId: string | null;
  origin: string;
  destination: string;
  currentLocation: string | null;
  selectedRouteOptionId: string | null;
  segments: Array<{
    segmentOrder: number;
    origin: string;
    destination: string;
    mode: string;
    carrier: string | null;
    flightNumber: string | null;
    status: string;
    scheduledDeparture: Date | null;
    scheduledArrival: Date | null;
    durationMinutes: number | null;
    riskLevel: string | null;
  }>;
  activeSegmentIndex: number | null;
  completedSegments: number;
  totalSegments: number;
  etaMinutes: number | null;
  riskLevel: string | null;
  slaRemainingMinutes: number | null;
  slaCompliant: boolean | null;
  executionStatus: string | null;
}

export interface RecoveryProvider {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  coverage: string[];
  status: string;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: Date;
}

export const recoveryApi = {
  list(params?: PaginationParams & { status?: string; recoveryType?: string; caseId?: string; baggageId?: string }) {
    return api.get<PaginatedData<RecoveryPlan>>('/recovery-plans', params as Record<string, string | number | undefined>);
  },

  get(planId: string) {
    return api.get<RecoveryPlan>(`/recovery-plans/${planId}`);
  },

  approve(planId: string, status: 'approved' | 'rejected') {
    return api.post<RecoveryPlan>(`/recovery-plans/${planId}/approve`, { status });
  },

  execute(planId: string) {
    return api.post<RecoveryPlan>(`/recovery-plans/${planId}/execute`);
  },

  getVersions(planId: string) {
    return api.get<RecoveryPlanVersion[]>(`/recovery-plans/${planId}/versions`);
  },

  providers() {
    return api.get<RecoveryProvider[]>('/recovery-providers');
  },

  getProvider(id: string) {
    return api.get<RecoveryProvider>(`/recovery-providers/${id}`);
  },
};
