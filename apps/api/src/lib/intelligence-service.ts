import { logger } from './logger.js';
import { aiGuardrails } from './ai-guardrails.js';
import { aiProviderService } from './ai-provider-service.js';
import { aiAuditService } from './ai-audit-service.js';
import { predictionEngine, type PredictionRequest, type PredictionResult } from './prediction-engine.js';
import { riskIntelligenceService, type RiskAssessmentResult } from './risk-intelligence-service.js';
import { anomalyDetectionService, type AnomalyResult } from './anomaly-detection-service.js';
import { rootCauseService, type RootCauseResult } from './root-cause-service.js';
import { recommendationEngine, type RecommendationResult } from './recommendation-engine.js';

export interface IntelligenceRequest {
  orgId: string;
  userId: string;
  subjectType: string;
  subjectId: string;
  operations: Array<'prediction' | 'risk' | 'anomaly' | 'root_cause' | 'recommendation'>;
  predictionType?: string;
  anomalyScanTypes?: string[];
}

export interface IntelligenceResponse {
  requestId: string;
  orgId: string;
  subjectType: string;
  subjectId: string;
  generatedAt: Date;
  model: string;
  version: string;
  predictions: PredictionResult[];
  riskAssessments: RiskAssessmentResult[];
  anomalies: AnomalyResult[];
  rootCauses: RootCauseResult[];
  recommendations: RecommendationResult[];
  warnings: string[];
}

class IntelligenceService {
  private readonly MODEL = 'deterministic';
  private readonly VERSION = 'heuristic-v1';

  async analyze(request: IntelligenceRequest): Promise<IntelligenceResponse> {
    const requestId = `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const warnings: string[] = [];
    const startTime = Date.now();

    try {
      const guardrailResult = await aiGuardrails.validate({
        tenantId: request.orgId,
        userId: request.userId,
        operation: 'intelligence.full_analysis',
        inputData: {
          subjectType: request.subjectType,
          subjectId: request.subjectId,
          operations: request.operations,
        },
        subjectType: request.subjectType,
        subjectId: request.subjectId,
      });

      if (!guardrailResult.allowed) {
        logger.warn({ requestId, reason: guardrailResult.reason }, 'Intelligence request blocked by guardrails');
        await aiAuditService.logGuardrailViolation(request.orgId, request.userId, {
          providerId: 'none',
          modelVersion: this.VERSION,
          subjectType: request.subjectType,
          subjectId: request.subjectId,
          result: 'BLOCKED',
          reason: guardrailResult.reason ?? 'unknown',
        });
        return this.blockedResponse(request, requestId, guardrailResult.reason ?? 'Request blocked by guardrails');
      }

      if (guardrailResult.warnings.length > 0) {
        warnings.push(...guardrailResult.warnings);
      }

      const predictions: PredictionResult[] = [];
      const riskAssessments: RiskAssessmentResult[] = [];
      const anomalies: AnomalyResult[] = [];
      const rootCauses: RootCauseResult[] = [];
      const recommendations: RecommendationResult[] = [];

      if (request.operations.includes('prediction')) {
        const predResult = await this.runPrediction(request);
        if (predResult) predictions.push(predResult);
      }

      if (request.operations.includes('risk')) {
        const riskResult = await this.runRiskAssessment(request);
        if (riskResult) riskAssessments.push(riskResult);
      }

      if (request.operations.includes('anomaly')) {
        const anomalyResults = await this.runAnomalyDetection(request);
        anomalies.push(...anomalyResults);
      }

      if (request.operations.includes('root_cause')) {
        const rcResult = await this.runRootCauseAnalysis(request);
        if (rcResult) rootCauses.push(rcResult);
      }

      if (request.operations.includes('recommendation')) {
        const recResults = await this.runRecommendationGeneration(
          request,
          predictions[0],
          riskAssessments[0],
          rootCauses[0],
          anomalies,
        );
        recommendations.push(...recResults);
      }

      const latencyMs = Date.now() - startTime;
      logger.info({
        requestId,
        orgId: request.orgId,
        subjectType: request.subjectType,
        subjectId: request.subjectId,
        operations: request.operations,
        predictions: predictions.length,
        risks: riskAssessments.length,
        anomalies: anomalies.length,
        rootCauses: rootCauses.length,
        recommendations: recommendations.length,
        latencyMs,
      }, 'Intelligence analysis completed');

      return {
        requestId,
        orgId: request.orgId,
        subjectType: request.subjectType,
        subjectId: request.subjectId,
        generatedAt: new Date(),
        model: this.MODEL,
        version: this.VERSION,
        predictions,
        riskAssessments,
        anomalies,
        rootCauses,
        recommendations,
        warnings,
      };
    } catch (err) {
      logger.error({ err, requestId, request }, 'Intelligence analysis failed');
      return this.failedResponse(request, requestId);
    }
  }

  async predict(request: PredictionRequest): Promise<PredictionResult> {
    const guardrailResult = await aiGuardrails.validate({
      tenantId: request.orgId,
      userId: request.orgId,
      operation: 'intelligence.prediction',
      inputData: { predictionType: request.predictionType, subjectType: request.subjectType, subjectId: request.subjectId },
      subjectType: request.subjectType,
      subjectId: request.subjectId,
    });

    if (!guardrailResult.allowed) {
      await aiAuditService.logGuardrailViolation(request.orgId, request.orgId, {
        providerId: 'none',
        modelVersion: this.VERSION,
        subjectType: request.subjectType,
        subjectId: request.subjectId,
        result: 'BLOCKED',
        reason: guardrailResult.reason ?? 'unknown',
      });
      return predictionEngine.analyzePrediction(request);
    }

    const result = await predictionEngine.analyzePrediction(request);

    await aiAuditService.logPrediction(request.orgId, request.orgId, {
      providerId: result.model,
      modelVersion: result.version,
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      confidence: result.probability,
      result: result.status === 'COMPLETED' ? 'SUCCESS' : 'FAILURE',
      latencyMs: 0,
    });

    return result;
  }

  private async runPrediction(request: IntelligenceRequest): Promise<PredictionResult | null> {
    try {
      const predictionType = (request.predictionType ?? 'SYSTEM_ANOMALY') as PredictionRequest['predictionType'];
      return await predictionEngine.analyzePrediction({
        orgId: request.orgId,
        subjectType: request.subjectType,
        subjectId: request.subjectId,
        predictionType,
      });
    } catch (err) {
      logger.error({ err, request }, 'Prediction sub-operation failed');
      return null;
    }
  }

  private async runRiskAssessment(request: IntelligenceRequest): Promise<RiskAssessmentResult | null> {
    try {
      return await riskIntelligenceService.assessRisk({
        orgId: request.orgId,
        subjectType: request.subjectType as 'baggage' | 'case' | 'recovery_plan' | 'airport',
        subjectId: request.subjectId,
      });
    } catch (err) {
      logger.error({ err, request }, 'Risk assessment sub-operation failed');
      return null;
    }
  }

  private async runAnomalyDetection(request: IntelligenceRequest): Promise<AnomalyResult[]> {
    try {
      return await anomalyDetectionService.detect({
        orgId: request.orgId,
        subjectType: request.subjectType as 'baggage' | 'case' | 'recovery_plan' | 'airport',
        subjectId: request.subjectId,
        scanTypes: request.anomalyScanTypes,
      });
    } catch (err) {
      logger.error({ err, request }, 'Anomaly detection sub-operation failed');
      return [];
    }
  }

  private async runRootCauseAnalysis(request: IntelligenceRequest): Promise<RootCauseResult | null> {
    try {
      return await rootCauseService.analyze({
        orgId: request.orgId,
        subjectType: request.subjectType as 'baggage' | 'case' | 'recovery_plan',
        subjectId: request.subjectId,
      });
    } catch (err) {
      logger.error({ err, request }, 'Root cause analysis sub-operation failed');
      return null;
    }
  }

  private async runRecommendationGeneration(
    request: IntelligenceRequest,
    prediction: PredictionResult | undefined,
    riskAssessment: RiskAssessmentResult | undefined,
    rootCause: RootCauseResult | undefined,
    anomalies: AnomalyResult[],
  ): Promise<RecommendationResult[]> {
    try {
      return await recommendationEngine.generateRecommendations({
        orgId: request.orgId,
        subjectType: request.subjectType,
        subjectId: request.subjectId,
        prediction,
        riskAssessment,
        rootCause,
        anomalies,
      });
    } catch (err) {
      logger.error({ err, request }, 'Recommendation generation sub-operation failed');
      return [];
    }
  }

  private blockedResponse(request: IntelligenceRequest, requestId: string, reason: string): IntelligenceResponse {
    return {
      requestId,
      orgId: request.orgId,
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      generatedAt: new Date(),
      model: this.MODEL,
      version: this.VERSION,
      predictions: [],
      riskAssessments: [],
      anomalies: [],
      rootCauses: [],
      recommendations: [],
      warnings: [reason],
    };
  }

  private failedResponse(request: IntelligenceRequest, requestId: string): IntelligenceResponse {
    return {
      requestId,
      orgId: request.orgId,
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      generatedAt: new Date(),
      model: this.MODEL,
      version: this.VERSION,
      predictions: [],
      riskAssessments: [],
      anomalies: [],
      rootCauses: [],
      recommendations: [],
      warnings: ['Intelligence analysis failed due to internal error.'],
    };
  }
}

export const intelligenceService = new IntelligenceService();
