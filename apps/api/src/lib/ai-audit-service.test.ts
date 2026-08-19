import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuditLog = vi.fn().mockResolvedValue(undefined);

vi.mock('./audit-logger', () => ({ auditLog: (...args: unknown[]) => mockAuditLog(...args) }));
vi.mock('./logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { AIAuditService } from './ai-audit-service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AIAuditService', () => {
  const service = new AIAuditService();

  describe('logPrediction', () => {
    it('calls auditLog with prediction action', async () => {
      await service.logPrediction('org-1', 'user-1', {
        providerId: 'deterministic',
        modelVersion: 'heuristic-v1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        confidence: 0.85,
        result: 'SUCCESS',
      });
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          userId: 'user-1',
          action: 'intelligence.prediction.generated',
          entityType: 'intelligence',
        }),
      );
    });

    it('does not throw on audit failure', async () => {
      mockAuditLog.mockRejectedValueOnce(new Error('audit failure'));
      await expect(
        service.logPrediction('org-1', 'user-1', {
          providerId: 'deterministic',
          modelVersion: 'heuristic-v1',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('logRiskAssessment', () => {
    it('calls auditLog with risk assessment action', async () => {
      await service.logRiskAssessment('org-1', 'user-1', {
        providerId: 'deterministic',
        modelVersion: 'heuristic-v1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        result: 'SUCCESS',
      });
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          action: 'intelligence.risk_assessment.generated',
        }),
      );
    });
  });

  describe('logAnomalyDetection', () => {
    it('calls auditLog with anomaly detection action', async () => {
      await service.logAnomalyDetection('org-1', 'user-1', {
        providerId: 'deterministic',
        modelVersion: 'heuristic-v1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        result: 'SUCCESS',
      });
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          action: 'intelligence.anomaly.detected',
        }),
      );
    });
  });

  describe('logRecommendation', () => {
    it('calls auditLog with recommendation action', async () => {
      await service.logRecommendation('org-1', 'user-1', {
        providerId: 'deterministic',
        modelVersion: 'heuristic-v1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        result: 'SUCCESS',
      });
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          action: 'intelligence.recommendation.generated',
        }),
      );
    });
  });

  describe('logRootCause', () => {
    it('calls auditLog with root cause action', async () => {
      await service.logRootCause('org-1', 'user-1', {
        providerId: 'deterministic',
        modelVersion: 'heuristic-v1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        result: 'SUCCESS',
      });
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          action: 'intelligence.root_cause.analyzed',
        }),
      );
    });
  });

  describe('logGuardrailViolation', () => {
    it('calls auditLog with blocked result', async () => {
      await service.logGuardrailViolation('org-1', 'user-1', {
        providerId: 'none',
        modelVersion: 'heuristic-v1',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        result: 'BLOCKED',
        reason: 'Rate limit exceeded',
      });
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          action: 'intelligence.guardrail.violation',
        }),
      );
    });
  });

  describe('logProviderFailure', () => {
    it('calls auditLog with failure result', async () => {
      await service.logProviderFailure('org-1', 'user-1', {
        providerId: 'openai',
        modelVersion: 'gpt-4o',
        subjectType: 'baggage',
        subjectId: 'bag-1',
        result: 'FAILURE',
        error: 'timeout',
      });
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-1',
          action: 'intelligence.provider.failure',
        }),
      );
    });
  });
});
