import { logger } from './logger';
import type { PredictionResult } from './prediction-engine';
import type { RiskAssessmentResult } from './risk-intelligence-service';
import type { RootCauseResult } from './root-cause-service';
import type { AnomalyResult } from './anomaly-detection-service';

export type RecommendationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RecommendationResult {
  id: string;
  organizationId: string;
  priority: RecommendationPriority;
  recommendation: string;
  evidence: Array<{ sourceType: string; sourceId: string; reason: string }>;
  confidence: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  impact: string;
  requiredApproval?: string;
  generatedAt: Date;
  model: string;
  version: string;
  status: 'COMPLETED' | 'FAILED';
}

interface RecommendationContext {
  orgId: string;
  subjectType: string;
  subjectId: string;
  prediction?: PredictionResult;
  riskAssessment?: RiskAssessmentResult;
  rootCause?: RootCauseResult;
  anomalies?: AnomalyResult[];
}

class RecommendationEngine {
  private readonly MODEL = 'deterministic';
  private readonly VERSION = 'heuristic-v1';

  async generateRecommendations(context: RecommendationContext): Promise<RecommendationResult[]> {
    const now = new Date();

    try {
      const recommendations: RecommendationResult[] = [];

      if (context.prediction && context.prediction.status === 'COMPLETED') {
        recommendations.push(...this.recommendationsFromPrediction(context, now));
      }

      if (context.riskAssessment && context.riskAssessment.status === 'COMPLETED') {
        recommendations.push(...this.recommendationsFromRisk(context, now));
      }

      if (context.rootCause && context.rootCause.status === 'COMPLETED') {
        recommendations.push(...this.recommendationsFromRootCause(context, now));
      }

      if (context.anomalies && context.anomalies.length > 0) {
        for (const anomaly of context.anomalies) {
          if (anomaly.status === 'COMPLETED') {
            recommendations.push(...this.recommendationsFromAnomaly(context, anomaly, now));
          }
        }
      }

      if (recommendations.length === 0) {
        recommendations.push({
          id: crypto.randomUUID(),
          organizationId: context.orgId,
          priority: 'LOW',
          recommendation: `No specific actions recommended for ${context.subjectType} ${context.subjectId} based on current analysis.`,
          evidence: [],
          confidence: 'VERY_LOW',
          impact: 'Monitoring only - no immediate action required.',
          generatedAt: now,
          model: this.MODEL,
          version: this.VERSION,
          status: 'COMPLETED',
        });
      }

      return this.deduplicate(recommendations);
    } catch (err) {
      logger.error({ err, context }, 'Recommendation generation failed');
      return [this.failedRecommendation(context, now)];
    }
  }

  private recommendationsFromPrediction(context: RecommendationContext, now: Date): RecommendationResult[] {
    const recs: RecommendationResult[] = [];
    const pred = context.prediction!;

    if (pred.probability >= 0.7 && pred.predictionType === 'TRANSFER_FAILURE') {
      recs.push({
        id: crypto.randomUUID(),
        organizationId: context.orgId,
        priority: 'CRITICAL',
        recommendation: 'Proactive transfer intervention recommended. Initiate immediate baggage transfer to prevent connection failure.',
        evidence: [...pred.evidence, { sourceType: 'prediction', sourceId: pred.id, reason: `${Math.round(pred.probability * 100)}% transfer failure probability` }],
        confidence: pred.confidence,
        impact: 'Prevents passenger disruption and reduces compensation costs. Proactive transfer avoids downstream case creation.',
        requiredApproval: 'transfer_operations',
        generatedAt: now,
        model: this.MODEL,
        version: this.VERSION,
        status: 'COMPLETED',
      });
    } else if (pred.probability >= 0.5 && pred.predictionType === 'TRANSFER_FAILURE') {
      recs.push({
        id: crypto.randomUUID(),
        organizationId: context.orgId,
        priority: 'HIGH',
        recommendation: 'Monitor baggage transfer closely. Prepare contingency routing in case transfer fails.',
        evidence: [...pred.evidence, { sourceType: 'prediction', sourceId: pred.id, reason: `${Math.round(pred.probability * 100)}% transfer failure probability` }],
        confidence: pred.confidence,
        impact: 'Early monitoring reduces response time if failure occurs.',
        generatedAt: now,
        model: this.MODEL,
        version: this.VERSION,
        status: 'COMPLETED',
      });
    }

    if (pred.probability >= 0.7 && pred.predictionType === 'SLA_MISS') {
      recs.push({
        id: crypto.randomUUID(),
        organizationId: context.orgId,
        priority: 'HIGH',
        recommendation: 'Escalate SLA at-risk item. Assign additional resources or reassign to meet SLA deadline.',
        evidence: [...pred.evidence, { sourceType: 'prediction', sourceId: pred.id, reason: `${Math.round(pred.probability * 100)}% SLA miss probability` }],
        confidence: pred.confidence,
        impact: 'Prevents SLA breach, maintains customer satisfaction and contractual compliance.',
        generatedAt: now,
        model: this.MODEL,
        version: this.VERSION,
        status: 'COMPLETED',
      });
    }

    if (pred.probability >= 0.6 && pred.predictionType === 'RECOVERY_FAILURE') {
      recs.push({
        id: crypto.randomUUID(),
        organizationId: context.orgId,
        priority: 'HIGH',
        recommendation: 'Review recovery plan. Consider assigning backup provider or escalating recovery approach.',
        evidence: [...pred.evidence, { sourceType: 'prediction', sourceId: pred.id, reason: `${Math.round(pred.probability * 100)}% recovery failure probability` }],
        confidence: pred.confidence,
        impact: 'Reduces risk of extended baggage loss and improves recovery success rate.',
        requiredApproval: 'recovery_management',
        generatedAt: now,
        model: this.MODEL,
        version: this.VERSION,
        status: 'COMPLETED',
      });
    }

    if (pred.probability >= 0.6 && pred.predictionType === 'CASE_ESCALATION') {
      recs.push({
        id: crypto.randomUUID(),
        organizationId: context.orgId,
        priority: 'MEDIUM',
        recommendation: 'Proactively address case before escalation. Review blockers and assign appropriate resources.',
        evidence: [...pred.evidence, { sourceType: 'prediction', sourceId: pred.id, reason: `${Math.round(pred.probability * 100)}% escalation probability` }],
        confidence: pred.confidence,
        impact: 'Prevents unnecessary escalation and reduces operational overhead.',
        generatedAt: now,
        model: this.MODEL,
        version: this.VERSION,
        status: 'COMPLETED',
      });
    }

    return recs;
  }

  private recommendationsFromRisk(context: RecommendationContext, now: Date): RecommendationResult[] {
    const recs: RecommendationResult[] = [];
    const risk = context.riskAssessment!;

    if (risk.riskLevel === 'CRITICAL') {
      recs.push({
        id: crypto.randomUUID(),
        organizationId: context.orgId,
        priority: 'CRITICAL',
        recommendation: `Critical risk detected for ${context.subjectType}. Immediate attention required. Review all risk factors and take corrective action.`,
        evidence: risk.evidence,
        confidence: risk.confidence,
        impact: 'Prevents service degradation, compliance violations, or customer impact.',
        requiredApproval: 'risk_management',
        generatedAt: now,
        model: this.MODEL,
        version: this.VERSION,
        status: 'COMPLETED',
      });
    } else if (risk.riskLevel === 'HIGH') {
      recs.push({
        id: crypto.randomUUID(),
        organizationId: context.orgId,
        priority: 'HIGH',
        recommendation: `Elevated risk for ${context.subjectType}. Prioritize resolution and assign experienced handler.`,
        evidence: risk.evidence,
        confidence: risk.confidence,
        impact: 'Reduces probability of incident escalation and improves resolution time.',
        generatedAt: now,
        model: this.MODEL,
        version: this.VERSION,
        status: 'COMPLETED',
      });
    }

    return recs;
  }

  private recommendationsFromRootCause(context: RecommendationContext, now: Date): RecommendationResult[] {
    const recs: RecommendationResult[] = [];
    const rc = context.rootCause!;

    for (const candidate of rc.candidates) {
      if (candidate.cause === 'missed_transfer' || candidate.cause === 'no_tracking_events') {
        recs.push({
          id: crypto.randomUUID(),
          organizationId: context.orgId,
          priority: 'HIGH',
          recommendation: 'Initiate manual baggage location search. Contact ground handling at last known transfer point.',
          evidence: candidate.evidence,
          confidence: candidate.confidence,
          impact: 'Locates baggage faster and prevents further delays in recovery.',
          generatedAt: now,
          model: this.MODEL,
          version: this.VERSION,
          status: 'COMPLETED',
        });
      }

      if (candidate.cause === 'blocked_dependencies') {
        recs.push({
          id: crypto.randomUUID(),
          organizationId: context.orgId,
          priority: 'MEDIUM',
          recommendation: 'Resolve blocked task dependencies. Reassign or unblock tasks to restore case progress.',
          evidence: candidate.evidence,
          confidence: candidate.confidence,
          impact: 'Unblocks case progression and prevents further SLA risk.',
          generatedAt: now,
          model: this.MODEL,
          version: this.VERSION,
          status: 'COMPLETED',
        });
      }

      if (candidate.cause === 'insufficient_authority') {
        recs.push({
          id: crypto.randomUUID(),
          organizationId: context.orgId,
          priority: 'MEDIUM',
          recommendation: 'Assign case to handler with appropriate escalation authority or approve escalation request.',
          evidence: candidate.evidence,
          confidence: candidate.confidence,
          impact: 'Enables case resolution without repeated escalation cycles.',
          generatedAt: now,
          model: this.MODEL,
          version: this.VERSION,
          status: 'COMPLETED',
        });
      }

      if (candidate.cause === 'sla_timeout' || candidate.cause === 'tight_sla') {
        recs.push({
          id: crypto.randomUUID(),
          organizationId: context.orgId,
          priority: 'HIGH',
          recommendation: 'Prioritize SLA-critical actions. Assign dedicated resources to meet remaining SLA window.',
          evidence: candidate.evidence,
          confidence: candidate.confidence,
          impact: 'Maximizes chance of meeting SLA and prevents breach penalties.',
          generatedAt: now,
          model: this.MODEL,
          version: this.VERSION,
          status: 'COMPLETED',
        });
      }
    }

    return recs;
  }

  private recommendationsFromAnomaly(
    context: RecommendationContext,
    anomaly: AnomalyResult,
    now: Date,
  ): RecommendationResult[] {
    const recs: RecommendationResult[] = [];

    if (anomaly.anomalyType === 'overdue_events' && (anomaly.severity === 'HIGH' || anomaly.severity === 'CRITICAL')) {
      recs.push({
        id: crypto.randomUUID(),
        organizationId: context.orgId,
        priority: 'HIGH',
        recommendation: 'Investigate overdue events immediately. Contact ground handlers at transfer points to determine baggage status.',
        evidence: anomaly.evidence,
        confidence: anomaly.confidence,
        impact: 'Identifies stalled baggage early and enables faster recovery intervention.',
        generatedAt: now,
        model: this.MODEL,
        version: this.VERSION,
        status: 'COMPLETED',
      });
    }

    if (anomaly.anomalyType === 'sla_breach' || anomaly.anomalyType === 'recovery_sla_breach') {
      recs.push({
        id: crypto.randomUUID(),
        organizationId: context.orgId,
        priority: 'CRITICAL',
        recommendation: 'SLA breach detected. Initiate breach protocol: notify stakeholders, escalate to management, and document root cause.',
        evidence: anomaly.evidence,
        confidence: anomaly.confidence,
        impact: 'Ensures compliance with breach reporting requirements and prevents compounding delays.',
        requiredApproval: 'sla_breach_escalation',
        generatedAt: now,
        model: this.MODEL,
        version: this.VERSION,
        status: 'COMPLETED',
      });
    }

    if (anomaly.anomalyType === 'volume_spike') {
      recs.push({
        id: crypto.randomUUID(),
        organizationId: context.orgId,
        priority: 'MEDIUM',
        recommendation: 'Volume spike detected. Consider activating surge capacity or redistributing workload across handlers.',
        evidence: anomaly.evidence,
        confidence: anomaly.confidence,
        impact: 'Prevents individual handler overload and maintains response time SLAs.',
        generatedAt: now,
        model: this.MODEL,
        version: this.VERSION,
        status: 'COMPLETED',
      });
    }

    return recs;
  }

  private deduplicate(recommendations: RecommendationResult[]): RecommendationResult[] {
    const seen = new Set<string>();
    const deduped: RecommendationResult[] = [];

    for (const rec of recommendations) {
      const key = `${rec.priority}:${rec.recommendation}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(rec);
      }
    }

    const priorityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    deduped.sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));

    return deduped;
  }

  private failedRecommendation(context: RecommendationContext, now: Date): RecommendationResult {
    return {
      id: crypto.randomUUID(),
      organizationId: context.orgId,
      priority: 'LOW',
      recommendation: 'Recommendation generation failed due to internal error.',
      evidence: [],
      confidence: 'VERY_LOW',
      impact: 'Unable to generate recommendations.',
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'FAILED',
    };
  }
}

export const recommendationEngine = new RecommendationEngine();
