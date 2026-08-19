import { api } from './client';

export interface AIActionProposal {
  id: string;
  orgId: string;
  creatorId: string;
  sessionId: string | null;
  actionType: string;
  targetType: string;
  targetId: string;
  reason: string;
  evidence: Array<{ sourceLayer: string; sourceType: string; sourceId: string; evidenceType: string; description: string; confidence: string; timestamp: Date | null }>;
  confidence: string;
  risk: string;
  requiredApproval: string;
  status: string;
  idempotencyKey: string;
  expiresAt: Date | null;
  executedAt: Date | null;
  executedBy: string | null;
  executionResult: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIApproval {
  id: string;
  proposalId: string;
  orgId: string;
  approverId: string;
  decision: string;
  reason: string | null;
  createdAt: Date;
}

export const actionProposalsApi = {
  list(params?: { status?: string }) {
    return api.get<AIActionProposal[]>('/action-proposals', params as Record<string, string | number | undefined>);
  },

  get(id: string) {
    return api.get<AIActionProposal>(`/action-proposals/${id}`);
  },

  approve(id: string, reason?: string) {
    return api.post<AIApproval>(`/action-proposals/${id}/approve`, { decision: 'APPROVED', reason });
  },

  reject(id: string, reason?: string) {
    return api.post<AIApproval>(`/action-proposals/${id}/reject`, { decision: 'REJECTED', reason });
  },
};
