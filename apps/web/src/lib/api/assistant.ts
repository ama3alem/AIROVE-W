import { api } from './client';

export interface AIConversationSession {
  id: string;
  orgId: string;
  userId: string;
  title: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  toolCalls: AIToolCall[] | null;
  evidence: AIEvidence[] | null;
  confidence: string | null;
  responseMode: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AIToolCall {
  id: string;
  messageId: string;
  toolName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  authorizationResult: string;
  durationMs: number | null;
  createdAt: Date;
}

export interface AIEvidence {
  sourceLayer: string;
  sourceType: string;
  sourceId: string;
  evidenceType: 'FACT' | 'INFERENCE' | 'RECOMMENDATION';
  description: string;
  confidence: string;
  timestamp: Date | null;
}

export interface AIResponse {
  answer: string;
  confidence: string;
  mode: string;
  evidence: AIEvidence[];
  facts: string[];
  inferences: string[];
  recommendations: string[];
  warnings: string[];
  actionProposalId: string | null;
}

export const assistantApi = {
  createSession(title?: string) {
    return api.post<AIConversationSession>('/assistant/sessions', { title });
  },

  getSessions() {
    return api.get<AIConversationSession[]>('/assistant/sessions');
  },

  getSession(sessionId: string) {
    return api.get<AIConversationSession>(`/assistant/sessions/${sessionId}`);
  },

  getMessages(sessionId: string) {
    return api.get<AIMessage[]>(`/assistant/sessions/${sessionId}/messages`);
  },

  sendMessage(sessionId: string, message: string) {
    return api.post<{ message: AIMessage; response: AIResponse }>(`/assistant/sessions/${sessionId}/messages`, { content: message });
  },
};
