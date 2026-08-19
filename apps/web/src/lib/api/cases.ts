import { api, type PaginatedData, type PaginationParams } from './client';

export interface Case {
  id: string;
  orgId: string;
  caseNumber: string;
  caseType: string;
  baggageId: string | null;
  flightId: string | null;
  journeyId: string | null;
  title: string | null;
  priority: string;
  status: string;
  assignedTo: string | null;
  assignedOrganizationId: string | null;
  originOrganizationId: string | null;
  sourceExceptionId: string | null;
  source: string;
  description: string | null;
  resolution: string | null;
  resolutionCode: string | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  escalatedAt: Date | null;
  workflowId: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseDetailView {
  case: Case;
  tasks: CaseTask[];
  activities: CaseActivity[];
  sla: CaseSLA | null;
  escalations: CaseEscalation[];
  commentCount: number;
}

export interface CaseTask {
  id: string;
  caseId: string | null;
  title: string;
  description: string | null;
  taskType: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface CaseActivity {
  id: string;
  caseId: string;
  activityType: string;
  actorId: string | null;
  description: string | null;
  previousValue: string | null;
  newValue: string | null;
  createdAt: Date;
}

export interface CaseSLA {
  id: string;
  caseId: string;
  status: string;
  responseDueAt: Date;
  resolutionDueAt: Date;
  respondedAt: Date | null;
  resolvedAt: Date | null;
}

export interface CaseEscalation {
  id: string;
  caseId: string;
  escalationLevel: string;
  status: string;
  triggeredAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  reason: string | null;
}

export interface CaseTimelineEntry {
  id: string;
  type: string;
  actorId: string | null;
  description: string | null;
  previousValue: string | null;
  newValue: string | null;
  timestamp: Date;
}

export interface Task {
  id: string;
  caseId: string | null;
  baggageId: string | null;
  title: string;
  description: string | null;
  taskType: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
  result: string | null;
  createdAt: Date;
}

export const casesApi = {
  list(params?: PaginationParams & { status?: string; priority?: string; caseType?: string; assignedTo?: string }) {
    return api.get<PaginatedData<Case>>('/cases', params as Record<string, string | number | undefined>);
  },

  get(id: string) {
    return api.get<Case>(`/cases/${id}`);
  },

  getDetail(id: string) {
    return api.get<CaseDetailView>(`/cases/${id}`);
  },

  getTimeline(id: string) {
    return api.get<CaseTimelineEntry[]>(`/cases/${id}/timeline`);
  },

  update(id: string, data: { title?: string; description?: string; priority?: string }) {
    return api.patch<Case>(`/cases/${id}`, data);
  },

  assign(id: string, data: { assignedTo: string; assignedOrganizationId?: string }) {
    return api.post<Case>(`/cases/${id}/assign`, data);
  },

  escalate(id: string) {
    return api.post<Case>(`/cases/${id}/escalate`);
  },

  resolve(id: string, data: { resolution: string; resolutionCode?: string }) {
    return api.post<Case>(`/cases/${id}/resolve`, data);
  },

  close(id: string) {
    return api.post<Case>(`/cases/${id}/close`);
  },

  reopen(id: string) {
    return api.post<Case>(`/cases/${id}/reopen`);
  },

  addComment(id: string, content: string) {
    return api.post<{ id: string; content: string; createdAt: Date }>(`/cases/${id}/comments`, { content });
  },
};

export const tasksApi = {
  list(params?: PaginationParams & { caseId?: string; status?: string; assignedTo?: string }) {
    return api.get<PaginatedData<Task>>('/tasks', params as Record<string, string | number | undefined>);
  },

  get(id: string) {
    return api.get<Task>(`/tasks/${id}`);
  },

  complete(id: string, result?: string) {
    return api.post<Task>(`/tasks/${id}/complete`, { result });
  },
};
