import { z } from 'zod';
import type {
  ConfidenceLevel,
  SeverityLevel,
  EvidenceReference,
} from './index.js';

// ─── Layer 8B: AI Operational Interface & Controlled Action Engine ──────────

// AI Conversation & Session Types

export type AIMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';

export type AIConversationStatus = 'ACTIVE' | 'CLOSED' | 'EXPIRED';

export type AIMessageStatus = 'PENDING' | 'DELIVERED' | 'FAILED' | 'FILTERED';

export type AIToolClassification = 'READ_ONLY' | 'LOW_IMPACT' | 'MEDIUM_IMPACT' | 'HIGH_IMPACT' | 'CRITICAL';

export type AIActionType =
  | 'ASSIGN_CASE'
  | 'CREATE_TASK'
  | 'CREATE_RECOVERY_PLAN'
  | 'APPROVE_RECOVERY_PLAN'
  | 'EXECUTE_RECOVERY_PLAN'
  | 'ASSIGN_RECOVERY_PROVIDER'
  | 'UPDATE_CASE_PRIORITY'
  | 'ESCALATE_CASE';

export type AIActionStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'FAILED';

export type AIApprovalDecision = 'APPROVED' | 'REJECTED';

export type AIInteractionType =
  | 'SESSION_CREATED'
  | 'MESSAGE_RECEIVED'
  | 'TOOL_REQUESTED'
  | 'TOOL_AUTHORIZED'
  | 'TOOL_DENIED'
  | 'TOOL_EXECUTED'
  | 'EVIDENCE_RETRIEVED'
  | 'PROVIDER_USED'
  | 'PROVIDER_FAILED'
  | 'FALLBACK_USED'
  | 'RESPONSE_GENERATED'
  | 'ACTION_PROPOSAL_CREATED'
  | 'ACTION_APPROVED'
  | 'ACTION_REJECTED'
  | 'ACTION_EXECUTED'
  | 'ACTION_FAILED'
  | 'GUARDRAIL_TRIGGERED'
  | 'PROMPT_INJECTION_BLOCKED';

export type AIResponseMode = 'AI_ASSISTED' | 'DETERMINISTIC_FALLBACK' | 'NO_PROVIDER';

export type AIConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export type AIExecutionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'TIMEOUT';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface AIConversationSession {
  id: string;
  orgId: string;
  userId: string;
  title: string | null;
  status: AIConversationStatus;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIMessage {
  id: string;
  sessionId: string;
  orgId: string;
  role: AIMessageRole;
  content: string;
  toolCalls: AIToolCall[] | null;
  evidence: AIEvidence[] | null;
  confidence: AIConfidence | null;
  responseMode: AIResponseMode | null;
  status: AIMessageStatus;
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
  confidence: AIConfidence;
  timestamp: Date | null;
}

export interface AIResponse {
  answer: string;
  confidence: AIConfidence;
  mode: AIResponseMode;
  evidence: AIEvidence[];
  facts: string[];
  inferences: string[];
  recommendations: string[];
  warnings: string[];
  actionProposalId: string | null;
}

export interface AIActionProposal {
  id: string;
  orgId: string;
  creatorId: string;
  sessionId: string | null;
  actionType: AIActionType;
  targetType: string;
  targetId: string;
  reason: string;
  evidence: AIEvidence[];
  confidence: AIConfidence;
  risk: AIToolClassification;
  requiredApproval: string;
  status: AIActionStatus;
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
  decision: AIApprovalDecision;
  reason: string | null;
  createdAt: Date;
}

export interface AIInteraction {
  id: string;
  orgId: string;
  userId: string;
  sessionId: string | null;
  interactionType: AIInteractionType;
  details: Record<string, unknown>;
  createdAt: Date;
}

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const aiConversationStatusEnum = z.enum(['ACTIVE', 'CLOSED', 'EXPIRED']);
export const aiMessageRoleEnum = z.enum(['USER', 'ASSISTANT', 'SYSTEM', 'TOOL']);
export const aiMessageStatusEnum = z.enum(['PENDING', 'DELIVERED', 'FAILED', 'FILTERED']);
export const aiToolClassificationEnum = z.enum(['READ_ONLY', 'LOW_IMPACT', 'MEDIUM_IMPACT', 'HIGH_IMPACT', 'CRITICAL']);
export const aiActionTypeEnum = z.enum([
  'ASSIGN_CASE',
  'CREATE_TASK',
  'CREATE_RECOVERY_PLAN',
  'APPROVE_RECOVERY_PLAN',
  'EXECUTE_RECOVERY_PLAN',
  'ASSIGN_RECOVERY_PROVIDER',
  'UPDATE_CASE_PRIORITY',
  'ESCALATE_CASE',
]);
export const aiActionStatusEnum = z.enum([
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
  'EXECUTING',
  'EXECUTED',
  'FAILED',
]);
export const aiApprovalDecisionEnum = z.enum(['APPROVED', 'REJECTED']);
export const aiInteractionTypeEnum = z.enum([
  'SESSION_CREATED',
  'MESSAGE_RECEIVED',
  'TOOL_REQUESTED',
  'TOOL_AUTHORIZED',
  'TOOL_DENIED',
  'TOOL_EXECUTED',
  'EVIDENCE_RETRIEVED',
  'PROVIDER_USED',
  'PROVIDER_FAILED',
  'FALLBACK_USED',
  'RESPONSE_GENERATED',
  'ACTION_PROPOSAL_CREATED',
  'ACTION_APPROVED',
  'ACTION_REJECTED',
  'ACTION_EXECUTED',
  'ACTION_FAILED',
  'GUARDRAIL_TRIGGERED',
  'PROMPT_INJECTION_BLOCKED',
]);
export const aiResponseModeEnum = z.enum(['AI_ASSISTED', 'DETERMINISTIC_FALLBACK', 'NO_PROVIDER']);
export const aiConfidenceEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const aiExecutionStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'TIMEOUT']);

export const aiEvidenceSchema = z.object({
  sourceLayer: z.string(),
  sourceType: z.string(),
  sourceId: z.string(),
  evidenceType: z.enum(['FACT', 'INFERENCE', 'RECOMMENDATION']),
  description: z.string(),
  confidence: aiConfidenceEnum,
  timestamp: z.date().nullable(),
});

export const assistantRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  sessionId: z.string().uuid().optional(),
});

export const assistantResponseSchema = z.object({
  answer: z.string(),
  confidence: aiConfidenceEnum,
  mode: aiResponseModeEnum,
  evidence: z.array(aiEvidenceSchema),
  facts: z.array(z.string()),
  inferences: z.array(z.string()),
  recommendations: z.array(z.string()),
  warnings: z.array(z.string()),
  actionProposalId: z.string().uuid().nullable().optional(),
});

export const createSessionSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});

export const createActionProposalSchema = z.object({
  actionType: aiActionTypeEnum,
  targetType: z.string().min(1).max(100),
  targetId: z.string().min(1).max(100),
  reason: z.string().min(1).max(5000),
  evidence: z.array(aiEvidenceSchema).optional(),
  confidence: aiConfidenceEnum.optional(),
  risk: aiToolClassificationEnum.optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
});

export const approvalRequestSchema = z.object({
  decision: aiApprovalDecisionEnum,
  reason: z.string().min(1).max(2000).optional(),
});

export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export type AssistantResponse = z.infer<typeof assistantResponseSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type CreateActionProposalInput = z.infer<typeof createActionProposalSchema>;
export type ApprovalRequestInput = z.infer<typeof approvalRequestSchema>;
