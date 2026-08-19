import { z } from 'zod';
import type {
  ConfidenceLevel,
  SeverityLevel,
  IntelligenceStatus,
  EvidenceReference,
} from '../types/intelligence-types';

const intelligenceTypeEnum = z.enum(['PREDICTION', 'ANOMALY', 'RISK', 'ROOT_CAUSE', 'RECOMMENDATION', 'ASSISTANT_RESPONSE']);
const intelligenceStatusEnum = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED']);
const confidenceLevelEnum = z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']);
const severityLevelEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

// AI Provider abstraction
export type AIProviderCapability = 
  | 'TEXT_GENERATION'
  | 'CLASSIFICATION'
  | 'EMBEDDING'
  | 'STRUCTURED_OUTPUT';

export interface AIProvider {
  id: string;
  name: string;
  capabilities: AIProviderCapability[];
  modelVersion: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DEPRECATED' | 'TESTING';
  configuration: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Prediction types
export type PredictionCategory = 
  | 'TRANSFER_FAILURE'
  | 'SLA_MISS'
  | 'BAGGAGE_DELAY'
  | 'BAGGAGE_MISDIRECTION'
  | 'RECOVERY_FAILURE'
  | 'CONNECTION_FAILURE'
  | 'DELIVERY_DELAY'
  | 'CASE_ESCALATION'
  | 'SYSTEM_ANOMALY';

export interface Prediction {
  id: string;
  organizationId: string;
  predictionType: PredictionCategory;
  subjectType: string;
  subjectId: string;
  probability: number;
  confidence: ConfidenceLevel;
  horizon: number; // minutes
  evidence: EvidenceReference[];
  explanation: string;
  model: string;
  version: string;
  generatedAt: Date;
  expiresAt?: Date;
  status: IntelligenceStatus;
}

// Risk assessment
export interface RiskAssessment {
  id: string;
  organizationId: string;
  subjectType: string;
  subjectId: string;
  riskLevel: SeverityLevel;
  factors: Array<{
    name: string;
    weight: number;
    description: string;
  }>;
  evidence: EvidenceReference[];
  explanation: string;
  confidence: ConfidenceLevel;
  generatedAt: Date;
  status: IntelligenceStatus;
}

// Anomaly detection
export interface AnomalyDetection {
  id: string;
  organizationId: string;
  anomalyType: string;
  subjectType: string;
  subjectId: string;
  severity: SeverityLevel;
  score: number;
  expectedBehavior: string;
  observedBehavior: string;
  evidence: EvidenceReference[];
  explanation: string;
  confidence: ConfidenceLevel;
  generatedAt: Date;
  status: IntelligenceStatus;
}

// Root cause analysis
export interface RootCauseCandidate {
  cause: string;
  confidence: ConfidenceLevel;
  evidence: EvidenceReference[];
  description: string;
}

export interface RootCauseAnalysis {
  id: string;
  organizationId: string;
  subjectType: string;
  subjectId: string;
  candidates: RootCauseCandidate[];
  evidence: EvidenceReference[];
  explanation: string;
  confidence: ConfidenceLevel;
  generatedAt: Date;
  status: IntelligenceStatus;
}

// Recommendation
export interface Recommendation {
  id: string;
  organizationId: string;
  priority: SeverityLevel;
  recommendation: string;
  evidence: EvidenceReference[];
  confidence: ConfidenceLevel;
  impact: string;
  requiredApproval?: string;
  generatedAt: Date;
  status: IntelligenceStatus;
}

// Zod schemas for validation
export const IntelligenceResultSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  type: intelligenceTypeEnum,
  status: intelligenceStatusEnum,
  confidence: confidenceLevelEnum,
  severity: severityLevelEnum.optional(),
  summary: z.string(),
  explanation: z.string(),
  evidence: z.array(z.object({
    sourceType: z.string(),
    sourceId: z.string(),
    reason: z.string(),
  })),
  metadata: z.object({
    generatedAt: z.date(),
    model: z.string(),
    version: z.string(),
    confidence: confidenceLevelEnum,
  }),
});

export const PredictionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  predictionType: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  probability: z.number().min(0).max(1),
  confidence: confidenceLevelEnum,
  horizon: z.number().int().positive(),
  evidence: z.array(z.object({
    sourceType: z.string(),
    sourceId: z.string(),
    reason: z.string(),
  })),
  explanation: z.string(),
  model: z.string(),
  version: z.string(),
  generatedAt: z.date(),
  expiresAt: z.date().optional(),
  status: intelligenceStatusEnum,
});

export const RiskAssessmentSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  riskLevel: severityLevelEnum,
  factors: z.array(z.object({
    name: z.string(),
    weight: z.number(),
    description: z.string(),
  })),
  evidence: z.array(z.object({
    sourceType: z.string(),
    sourceId: z.string(),
    reason: z.string(),
  })),
  explanation: z.string(),
  confidence: confidenceLevelEnum,
  generatedAt: z.date(),
  status: intelligenceStatusEnum,
});

export const AnomalyDetectionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  anomalyType: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  severity: severityLevelEnum,
  score: z.number().min(0).max(1),
  expectedBehavior: z.string(),
  observedBehavior: z.string(),
  evidence: z.array(z.object({
    sourceType: z.string(),
    sourceId: z.string(),
    reason: z.string(),
  })),
  explanation: z.string(),
  confidence: confidenceLevelEnum,
  generatedAt: z.date(),
  status: intelligenceStatusEnum,
});

export const RootCauseAnalysisSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  candidates: z.array(z.object({
    cause: z.string(),
    confidence: confidenceLevelEnum,
    evidence: z.array(z.object({
      sourceType: z.string(),
      sourceId: z.string(),
      reason: z.string(),
    })),
    description: z.string(),
  })),
  evidence: z.array(z.object({
    sourceType: z.string(),
    sourceId: z.string(),
    reason: z.string(),
  })),
  explanation: z.string(),
  confidence: confidenceLevelEnum,
  generatedAt: z.date(),
  status: intelligenceStatusEnum,
});

export const RecommendationSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  priority: severityLevelEnum,
  recommendation: z.string(),
  evidence: z.array(z.object({
    sourceType: z.string(),
    sourceId: z.string(),
    reason: z.string(),
  })),
  confidence: confidenceLevelEnum,
  impact: z.string(),
  requiredApproval: z.string().optional(),
  generatedAt: z.date(),
  status: intelligenceStatusEnum,
});