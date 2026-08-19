import { api } from './client';

export interface Integration {
  id: string;
  orgId: string;
  name: string;
  type: string;
  provider: string | null;
  status: string;
  lastSyncAt: Date | null;
  lastErrorAt: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
  totalEventsReceived: number;
  totalEventsFailed: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationHealth {
  integrationId: string;
  status: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  failureRate: number;
  totalReceived: number;
  totalFailed: number;
  consecutiveFailures: number;
}

export interface IntegrationEvent {
  id: string;
  integrationId: string;
  externalEventId: string;
  eventType: string;
  status: string;
  failureReason: string | null;
  retryCount: number;
  receivedAt: Date;
  processedAt: Date | null;
  failedAt: Date | null;
}

export const integrationsApi = {
  list() {
    return api.get<Integration[]>('/integrations');
  },

  get(id: string) {
    return api.get<Integration>(`/integrations/${id}`);
  },

  getHealth(id: string) {
    return api.get<IntegrationHealth>(`/integrations/${id}/health`);
  },

  getEvents(id: string, params?: { page?: number; pageSize?: number }) {
    return api.get<{ items: IntegrationEvent[]; total: number; page: number; pageSize: number; totalPages: number }>(`/integrations/${id}/events`, params as Record<string, string | number | undefined>);
  },

  activate(id: string) {
    return api.post<Integration>(`/integrations/${id}/activate`);
  },

  pause(id: string) {
    return api.post<Integration>(`/integrations/${id}/pause`);
  },

  test(id: string) {
    return api.post<{ status: string; integrationId: string }>(`/integrations/${id}/test`);
  },
};
