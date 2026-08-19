import { auditLog } from './audit-logger.js';
import { logger } from './logger.js';

export interface AIAuditEntry {
  orgId: string;
  userId: string;
  action: string;
  intelligenceType: string;
  providerId: string;
  modelVersion: string;
  subjectType?: string;
  subjectId?: string;
  confidence?: number;
  result?: 'SUCCESS' | 'FAILURE' | 'FALLBACK' | 'BLOCKED';
  latencyMs?: number;
  inputSize?: number;
  outputSize?: number;
  guardrailResult?: string;
}

function buildAuditChanges(entry: AIAuditEntry): string {
  const changes: Record<string, unknown> = {
    intelligenceType: entry.intelligenceType,
    providerId: entry.providerId,
    modelVersion: entry.modelVersion,
  };

  if (entry.subjectType) changes['subjectType'] = entry.subjectType;
  if (entry.subjectId) changes['subjectId'] = entry.subjectId;
  if (entry.confidence !== undefined) changes['confidence'] = entry.confidence;
  if (entry.result) changes['result'] = entry.result;
  if (entry.latencyMs !== undefined) changes['latencyMs'] = entry.latencyMs;
  if (entry.inputSize !== undefined) changes['inputSize'] = entry.inputSize;
  if (entry.outputSize !== undefined) changes['outputSize'] = entry.outputSize;
  if (entry.guardrailResult) changes['guardrailResult'] = entry.guardrailResult;

  return JSON.stringify(changes);
}

export class AIAuditService {
  async logPrediction(
    orgId: string,
    userId: string,
    entry: Omit<AIAuditEntry, 'orgId' | 'userId' | 'action' | 'intelligenceType'>,
  ): Promise<void> {
    try {
      await auditLog({
        orgId,
        userId,
        action: 'intelligence.prediction.generated',
        entityType: 'intelligence',
        entityId: entry.subjectId,
        entityRef: entry.providerId,
        changes: buildAuditChanges({ ...entry, orgId, userId, action: 'intelligence.prediction.generated', intelligenceType: 'PREDICTION' }),
      });
    } catch (err) {
      logger.error({ err, orgId, action: 'intelligence.prediction.generated' }, 'Failed to log AI audit entry');
    }
  }

  async logRiskAssessment(
    orgId: string,
    userId: string,
    entry: Omit<AIAuditEntry, 'orgId' | 'userId' | 'action' | 'intelligenceType'>,
  ): Promise<void> {
    try {
      await auditLog({
        orgId,
        userId,
        action: 'intelligence.risk_assessment.generated',
        entityType: 'intelligence',
        entityId: entry.subjectId,
        entityRef: entry.providerId,
        changes: buildAuditChanges({ ...entry, orgId, userId, action: 'intelligence.risk_assessment.generated', intelligenceType: 'RISK' }),
      });
    } catch (err) {
      logger.error({ err, orgId, action: 'intelligence.risk_assessment.generated' }, 'Failed to log AI audit entry');
    }
  }

  async logAnomalyDetection(
    orgId: string,
    userId: string,
    entry: Omit<AIAuditEntry, 'orgId' | 'userId' | 'action' | 'intelligenceType'>,
  ): Promise<void> {
    try {
      await auditLog({
        orgId,
        userId,
        action: 'intelligence.anomaly.detected',
        entityType: 'intelligence',
        entityId: entry.subjectId,
        entityRef: entry.providerId,
        changes: buildAuditChanges({ ...entry, orgId, userId, action: 'intelligence.anomaly.detected', intelligenceType: 'ANOMALY' }),
      });
    } catch (err) {
      logger.error({ err, orgId, action: 'intelligence.anomaly.detected' }, 'Failed to log AI audit entry');
    }
  }

  async logRootCause(
    orgId: string,
    userId: string,
    entry: Omit<AIAuditEntry, 'orgId' | 'userId' | 'action' | 'intelligenceType'>,
  ): Promise<void> {
    try {
      await auditLog({
        orgId,
        userId,
        action: 'intelligence.root_cause.analyzed',
        entityType: 'intelligence',
        entityId: entry.subjectId,
        entityRef: entry.providerId,
        changes: buildAuditChanges({ ...entry, orgId, userId, action: 'intelligence.root_cause.analyzed', intelligenceType: 'ROOT_CAUSE' }),
      });
    } catch (err) {
      logger.error({ err, orgId, action: 'intelligence.root_cause.analyzed' }, 'Failed to log AI audit entry');
    }
  }

  async logRecommendation(
    orgId: string,
    userId: string,
    entry: Omit<AIAuditEntry, 'orgId' | 'userId' | 'action' | 'intelligenceType'>,
  ): Promise<void> {
    try {
      await auditLog({
        orgId,
        userId,
        action: 'intelligence.recommendation.generated',
        entityType: 'intelligence',
        entityId: entry.subjectId,
        entityRef: entry.providerId,
        changes: buildAuditChanges({ ...entry, orgId, userId, action: 'intelligence.recommendation.generated', intelligenceType: 'RECOMMENDATION' }),
      });
    } catch (err) {
      logger.error({ err, orgId, action: 'intelligence.recommendation.generated' }, 'Failed to log AI audit entry');
    }
  }

  async logGuardrailViolation(
    orgId: string,
    userId: string,
    entry: Omit<AIAuditEntry, 'orgId' | 'userId' | 'action' | 'intelligenceType'> & {
      reason: string;
    },
  ): Promise<void> {
    try {
      await auditLog({
        orgId,
        userId,
        action: 'intelligence.guardrail.violation',
        entityType: 'guardrail',
        entityId: entry.subjectId,
        entityRef: entry.providerId,
        changes: buildAuditChanges({ ...entry, orgId, userId, action: 'intelligence.guardrail.violation', intelligenceType: 'GUARDRAIL_VIOLATION' }),
      });
    } catch (err) {
      logger.error({ err, orgId, action: 'intelligence.guardrail.violation' }, 'Failed to log AI audit entry');
    }
  }

  async logProviderFailure(
    orgId: string,
    userId: string,
    entry: Omit<AIAuditEntry, 'orgId' | 'userId' | 'action' | 'intelligenceType'> & {
      error: string;
    },
  ): Promise<void> {
    try {
      await auditLog({
        orgId,
        userId,
        action: 'intelligence.provider.failure',
        entityType: 'intelligence',
        entityId: entry.subjectId,
        entityRef: entry.providerId,
        changes: buildAuditChanges({ ...entry, orgId, userId, action: 'intelligence.provider.failure', intelligenceType: 'PROVIDER_FAILURE' }),
      });
    } catch (err) {
      logger.error({ err, orgId, action: 'intelligence.provider.failure' }, 'Failed to log AI audit entry');
    }
  }
}

export const aiAuditService = new AIAuditService();
