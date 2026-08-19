import { z } from 'zod';
import type {
  IntelligenceType,
  ConfidenceLevel,
  SeverityLevel,
  IntelligenceResult,
} from './index.js';

export type {
  IntelligenceType,
  ConfidenceLevel,
  SeverityLevel,
  IntelligenceResult,
};

export const IntelligenceResultSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  type: z.enum(['PREDICTION', 'ANOMALY', 'RISK', 'ROOT_CAUSE', 'RECOMMENDATION', 'ASSISTANT_RESPONSE']),
  subjectType: z.string().optional(),
  subjectId: z.string().optional(),
  confidence: z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['GENERATED', 'ACTIVE', 'EXPIRED', 'INVALIDATED']),
  summary: z.string(),
  explanation: z.string(),
  evidence: z.array(z.string()).optional(),
  recommendations: z.array(z.object({
    id: z.string().uuid(),
    reason: z.string(),
    benefit: z.string(),
    risk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    requiredApproval: z.string().optional(),
  })).optional(),
  modelMeta: z.object({
    provider: z.string(),
    modelVersion: z.string(),
    confidenceThreshold: z.number().optional(),
  }).optional(),
});
