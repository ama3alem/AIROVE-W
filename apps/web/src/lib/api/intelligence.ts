import { api } from './client';

export interface Prediction {
  id: string;
  organizationId: string;
  predictionType: string;
  subjectType: string;
  subjectId: string;
  probability: number;
  confidence: string;
  horizon: number;
  evidence: Array<{ sourceType: string; sourceId: string; reason: string }>;
  explanation: string;
  model: string;
  version: string;
  generatedAt: Date;
  expiresAt?: Date;
  status: string;
}

export interface RiskAssessment {
  id: string;
  organizationId: string;
  subjectType: string;
  subjectId: string;
  riskLevel: string;
  factors: Array<{ name: string; weight: number; description: string }>;
  evidence: Array<{ sourceType: string; sourceId: string; reason: string }>;
  explanation: string;
  confidence: string;
  generatedAt: Date;
  status: string;
}

export interface AnomalyDetection {
  id: string;
  organizationId: string;
  anomalyType: string;
  subjectType: string;
  subjectId: string;
  severity: string;
  score: number;
  expectedBehavior: string;
  observedBehavior: string;
  evidence: Array<{ sourceType: string; sourceId: string; reason: string }>;
  explanation: string;
  confidence: string;
  generatedAt: Date;
  status: string;
}

export interface RootCauseAnalysis {
  id: string;
  organizationId: string;
  subjectType: string;
  subjectId: string;
  candidates: Array<{ cause: string; confidence: string; evidence: Array<{ sourceType: string; sourceId: string; reason: string }>; description: string }>;
  evidence: Array<{ sourceType: string; sourceId: string; reason: string }>;
  explanation: string;
  confidence: string;
  generatedAt: Date;
  status: string;
}

export interface Recommendation {
  id: string;
  organizationId: string;
  priority: string;
  recommendation: string;
  evidence: Array<{ sourceType: string; sourceId: string; reason: string }>;
  confidence: string;
  impact: string;
  requiredApproval?: string;
  generatedAt: Date;
  status: string;
}

export const intelligenceApi = {
  getPredictions(params?: { status?: string; subjectType?: string }) {
    return api.get<Prediction[]>('/intelligence/predictions', params as Record<string, string | number | undefined>);
  },

  getRisks(params?: { subjectType?: string }) {
    return api.get<RiskAssessment[]>('/intelligence/risks', params as Record<string, string | number | undefined>);
  },

  getAnomalies(params?: { severity?: string }) {
    return api.get<AnomalyDetection[]>('/intelligence/anomalies', params as Record<string, string | number | undefined>);
  },

  getRootCauses(params?: { subjectType?: string }) {
    return api.get<RootCauseAnalysis[]>('/intelligence/root-causes', params as Record<string, string | number | undefined>);
  },

  getRecommendations(params?: { status?: string }) {
    return api.get<Recommendation[]>('/intelligence/recommendations', params as Record<string, string | number | undefined>);
  },
};
