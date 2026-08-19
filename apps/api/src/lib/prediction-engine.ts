import { db, baggageStateProjections, cases, caseSla, expectedEvents, recoveryPlans } from '@airove/db';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from './logger.js';

export type PredictionCategory =
  | 'TRANSFER_FAILURE' | 'SLA_MISS' | 'BAGGAGE_DELAY' | 'BAGGAGE_MISDIRECTION'
  | 'RECOVERY_FAILURE' | 'CONNECTION_FAILURE' | 'DELIVERY_DELAY' | 'CASE_ESCALATION' | 'SYSTEM_ANOMALY';

export interface PredictionRequest {
  orgId: string;
  subjectType: string;
  subjectId: string;
  predictionType: PredictionCategory;
  timeHorizonMinutes?: number;
}

export interface PredictionResult {
  id: string;
  organizationId: string;
  predictionType: PredictionCategory;
  subjectType: string;
  subjectId: string;
  probability: number;
  confidence: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  horizon: number;
  evidence: Array<{ sourceType: string; sourceId: string; reason: string }>;
  explanation: string;
  model: string;
  version: string;
  generatedAt: Date;
  expiresAt: Date;
  status: 'COMPLETED' | 'FAILED';
}

class PredictionEngineService {
  private readonly MODEL = 'deterministic';
  private readonly VERSION = 'heuristic-v1';

  async analyzePrediction(request: PredictionRequest): Promise<PredictionResult> {
    const horizon = request.timeHorizonMinutes ?? 240;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + horizon * 60 * 1000);

    try {
      switch (request.predictionType) {
        case 'TRANSFER_FAILURE':
          return this.predictTransferFailure(request, horizon, now, expiresAt);
        case 'SLA_MISS':
          return this.predictSlaMiss(request, horizon, now, expiresAt);
        case 'BAGGAGE_DELAY':
          return this.predictBaggageDelay(request, horizon, now, expiresAt);
        case 'CASE_ESCALATION':
          return this.predictCaseEscalation(request, horizon, now, expiresAt);
        case 'RECOVERY_FAILURE':
          return this.predictRecoveryFailure(request, horizon, now, expiresAt);
        default:
          return this.genericPrediction(request, horizon, now, expiresAt);
      }
    } catch (err) {
      logger.error({ err, request }, 'Prediction failed');
      return this.failedPrediction(request, horizon, now, expiresAt);
    }
  }

  private async predictTransferFailure(
    request: PredictionRequest, horizon: number, now: Date, expiresAt: Date,
  ): Promise<PredictionResult> {
    const evidence: Array<{ sourceType: string; sourceId: string; reason: string }> = [];
    let probability = 0.3;
    let dataPoints = 0;

    const stateRows = await db
      .select()
      .from(baggageStateProjections)
      .where(
        and(
          eq(baggageStateProjections.orgId, request.orgId),
          eq(baggageStateProjections.baggageId, request.subjectId),
        ),
      )
      .limit(1);

    const state = stateRows[0];
    if (state) {
      evidence.push({ sourceType: 'BAGGAGE_STATE', sourceId: state['id'], reason: `Current state: ${state['currentState']}` });
      dataPoints++;

      if (state['expectedNextEventAt']) {
        const minutesUntil = (new Date(state['expectedNextEventAt']).getTime() - now.getTime()) / 60000;
        if (minutesUntil < 60) {
          probability += 0.25;
          evidence.push({ sourceType: 'EXPECTED_EVENT', sourceId: state['id'], reason: `Only ${Math.round(minutesUntil)} min until expected event` });
        } else if (minutesUntil < 120) {
          probability += 0.1;
          evidence.push({ sourceType: 'EXPECTED_EVENT', sourceId: state['id'], reason: `${Math.round(minutesUntil)} min until expected event` });
        }
        dataPoints++;
      }

      if (state['lastEventAt']) {
        const hoursSince = (now.getTime() - new Date(state['lastEventAt']).getTime()) / 3600000;
        if (hoursSince > 24) {
          probability += 0.15;
          evidence.push({ sourceType: 'EVENT_GAP', sourceId: state['id'], reason: `No events for ${Math.round(hoursSince)} hours` });
          dataPoints++;
        }
      }
    }

    const caseRows = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(cases)
      .where(
        and(
          eq(cases.orgId, request.orgId),
          eq(cases.baggageId, request.subjectId),
          eq(cases.status, 'open'),
        ),
      )
      .limit(1);

    const openCases = caseRows[0]?.['cnt'] ?? 0;
    if (openCases > 0) {
      probability += 0.15 * Math.min(openCases, 3);
      evidence.push({ sourceType: 'CASE', sourceId: request.subjectId, reason: `${openCases} active case(s) for this baggage` });
      dataPoints++;
    }

    probability = Math.min(probability, 0.95);
    const confidence = this.computeConfidence(dataPoints);

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      predictionType: 'TRANSFER_FAILURE',
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      probability: Math.round(probability * 100) / 100,
      confidence,
      horizon,
      evidence,
      explanation: this.generateTransferExplanation(probability, evidence),
      model: this.MODEL,
      version: this.VERSION,
      generatedAt: now,
      expiresAt,
      status: 'COMPLETED',
    };
  }

  private async predictSlaMiss(
    request: PredictionRequest, horizon: number, now: Date, expiresAt: Date,
  ): Promise<PredictionResult> {
    const evidence: Array<{ sourceType: string; sourceId: string; reason: string }> = [];
    let probability = 0.2;
    let dataPoints = 0;

    const slaRows = await db
      .select()
      .from(caseSla)
      .where(
        and(
          eq(caseSla.orgId, request.orgId),
          eq(caseSla.caseId, request.subjectId),
        ),
      )
      .limit(1);

    const sla = slaRows[0];
    if (sla) {
      evidence.push({ sourceType: 'SLA', sourceId: sla['id'], reason: `SLA status: ${sla['status']}` });
      dataPoints++;

      if (sla['resolutionDueAt']) {
        const minutesRemaining = (new Date(sla['resolutionDueAt']).getTime() - now.getTime()) / 60000;
        if (minutesRemaining < 0) {
          probability = 0.95;
          evidence.push({ sourceType: 'SLA', sourceId: sla['id'], reason: 'SLA already breached' });
        } else if (minutesRemaining < 60) {
          probability = 0.8;
          evidence.push({ sourceType: 'SLA', sourceId: sla['id'], reason: `Only ${Math.round(minutesRemaining)} minutes remaining` });
        } else if (minutesRemaining < 180) {
          probability = 0.5;
          evidence.push({ sourceType: 'SLA', sourceId: sla['id'], reason: `${Math.round(minutesRemaining)} minutes remaining` });
        } else {
          probability = 0.15;
          evidence.push({ sourceType: 'SLA', sourceId: sla['id'], reason: `${Math.round(minutesRemaining)} minutes remaining` });
        }
        dataPoints++;
      }

      if (sla['totalPausedMs'] && sla['totalPausedMs'] > 0) {
        probability -= 0.05;
        evidence.push({ sourceType: 'SLA', sourceId: sla['id'], reason: `SLA paused for ${Math.round(sla['totalPausedMs'] / 60000)} minutes` });
        dataPoints++;
      }
    }

    probability = Math.max(0.01, Math.min(probability, 0.99));
    const confidence = this.computeConfidence(dataPoints);

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      predictionType: 'SLA_MISS',
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      probability: Math.round(probability * 100) / 100,
      confidence,
      horizon,
      evidence,
      explanation: `Based on ${dataPoints} data points, there is a ${Math.round(probability * 100)}% probability of SLA breach within ${horizon} minutes.`,
      model: this.MODEL,
      version: this.VERSION,
      generatedAt: now,
      expiresAt,
      status: 'COMPLETED',
    };
  }

  private async predictBaggageDelay(
    request: PredictionRequest, horizon: number, now: Date, expiresAt: Date,
  ): Promise<PredictionResult> {
    const evidence: Array<{ sourceType: string; sourceId: string; reason: string }> = [];
    let probability = 0.25;
    let dataPoints = 0;

    const stateRows = await db
      .select()
      .from(baggageStateProjections)
      .where(
        and(
          eq(baggageStateProjections.orgId, request.orgId),
          eq(baggageStateProjections.baggageId, request.subjectId),
        ),
      )
      .limit(1);

    const state = stateRows[0];
    if (state) {
      evidence.push({ sourceType: 'BAGGAGE_STATE', sourceId: state['id'], reason: `State: ${state['currentState']}, location: ${state['currentLocation'] ?? 'unknown'}` });
      dataPoints++;

      if (state['eventCount'] !== null && state['eventCount'] !== undefined && state['eventCount'] < 2) {
        probability += 0.2;
        evidence.push({ sourceType: 'EVENT_COUNT', sourceId: state['id'], reason: `Only ${state['eventCount']} event(s) recorded` });
        dataPoints++;
      }
    }

    const eventRows = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(expectedEvents)
      .where(
        and(
          eq(expectedEvents.orgId, request.orgId),
          eq(expectedEvents.baggageId, request.subjectId),
          eq(expectedEvents.status, 'overdue'),
        ),
      )
      .limit(1);

    const overdueCount = eventRows[0]?.['cnt'] ?? 0;
    if (overdueCount > 0) {
      probability += 0.3 * Math.min(overdueCount, 3);
      evidence.push({ sourceType: 'OVERDUE_EVENTS', sourceId: request.subjectId, reason: `${overdueCount} overdue expected event(s)` });
      dataPoints++;
    }

    probability = Math.max(0.01, Math.min(probability, 0.99));
    const confidence = this.computeConfidence(dataPoints);

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      predictionType: 'BAGGAGE_DELAY',
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      probability: Math.round(probability * 100) / 100,
      confidence,
      horizon,
      evidence,
      explanation: `Based on ${dataPoints} data points, there is a ${Math.round(probability * 100)}% probability of baggage delay within ${horizon} minutes.`,
      model: this.MODEL,
      version: this.VERSION,
      generatedAt: now,
      expiresAt,
      status: 'COMPLETED',
    };
  }

  private async predictCaseEscalation(
    request: PredictionRequest, horizon: number, now: Date, expiresAt: Date,
  ): Promise<PredictionResult> {
    const evidence: Array<{ sourceType: string; sourceId: string; reason: string }> = [];
    let probability = 0.2;
    let dataPoints = 0;

    const caseRows = await db
      .select()
      .from(cases)
      .where(
        and(
          eq(cases.orgId, request.orgId),
          eq(cases.id, request.subjectId),
        ),
      )
      .limit(1);

    const caseRecord = caseRows[0];
    if (caseRecord) {
      evidence.push({ sourceType: 'CASE', sourceId: caseRecord['id'], reason: `Status: ${caseRecord['status']}, priority: ${caseRecord['priority']}` });
      dataPoints++;

      const ageHours = (now.getTime() - new Date(caseRecord['createdAt']).getTime()) / 3600000;
      if (ageHours > 24) {
        probability += 0.25;
        evidence.push({ sourceType: 'CASE_AGE', sourceId: caseRecord['id'], reason: `Case is ${Math.round(ageHours)} hours old` });
      } else if (ageHours > 8) {
        probability += 0.1;
        evidence.push({ sourceType: 'CASE_AGE', sourceId: caseRecord['id'], reason: `Case is ${Math.round(ageHours)} hours old` });
      }
      dataPoints++;

      if (caseRecord['priority'] === 'critical' || caseRecord['priority'] === 'high') {
        probability += 0.15;
        evidence.push({ sourceType: 'PRIORITY', sourceId: caseRecord['id'], reason: 'High/critical priority' });
        dataPoints++;
      }
    }

    probability = Math.max(0.01, Math.min(probability, 0.99));
    const confidence = this.computeConfidence(dataPoints);

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      predictionType: 'CASE_ESCALATION',
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      probability: Math.round(probability * 100) / 100,
      confidence,
      horizon,
      evidence,
      explanation: `Based on ${dataPoints} data points, there is a ${Math.round(probability * 100)}% probability of escalation within ${horizon} minutes.`,
      model: this.MODEL,
      version: this.VERSION,
      generatedAt: now,
      expiresAt,
      status: 'COMPLETED',
    };
  }

  private async predictRecoveryFailure(
    request: PredictionRequest, horizon: number, now: Date, expiresAt: Date,
  ): Promise<PredictionResult> {
    const evidence: Array<{ sourceType: string; sourceId: string; reason: string }> = [];
    let probability = 0.2;
    let dataPoints = 0;

    const planRows = await db
      .select()
      .from(recoveryPlans)
      .where(
        and(
          eq(recoveryPlans.orgId, request.orgId),
          eq(recoveryPlans.id, request.subjectId),
        ),
      )
      .limit(1);

    const plan = planRows[0];
    if (plan) {
      evidence.push({ sourceType: 'RECOVERY_PLAN', sourceId: plan['id'], reason: `Status: ${plan['status']}, risk: ${plan['riskLevel'] ?? 'unknown'}` });
      dataPoints++;

      if (plan['slaRemainingMinutes'] !== null && plan['slaRemainingMinutes'] !== undefined && plan['slaRemainingMinutes'] < 60) {
        probability += 0.3;
        evidence.push({ sourceType: 'SLA_REMAINING', sourceId: plan['id'], reason: `Only ${plan['slaRemainingMinutes']} min SLA remaining` });
        dataPoints++;
      }

      if (plan['riskLevel'] === 'critical' || plan['riskLevel'] === 'high') {
        probability += 0.2;
        evidence.push({ sourceType: 'RISK_LEVEL', sourceId: plan['id'], reason: `Plan risk: ${plan['riskLevel']}` });
        dataPoints++;
      }
    }

    probability = Math.max(0.01, Math.min(probability, 0.99));
    const confidence = this.computeConfidence(dataPoints);

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      predictionType: 'RECOVERY_FAILURE',
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      probability: Math.round(probability * 100) / 100,
      confidence,
      horizon,
      evidence,
      explanation: `Based on ${dataPoints} data points, there is a ${Math.round(probability * 100)}% probability of recovery failure within ${horizon} minutes.`,
      model: this.MODEL,
      version: this.VERSION,
      generatedAt: now,
      expiresAt,
      status: 'COMPLETED',
    };
  }

  private genericPrediction(
    request: PredictionRequest, horizon: number, now: Date, expiresAt: Date,
  ): PredictionResult {
    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      predictionType: request.predictionType,
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      probability: 0.5,
      confidence: 'VERY_LOW',
      horizon,
      evidence: [],
      explanation: `Insufficient data for a specific prediction for ${request.predictionType}.`,
      model: this.MODEL,
      version: this.VERSION,
      generatedAt: now,
      expiresAt,
      status: 'COMPLETED',
    };
  }

  private failedPrediction(
    request: PredictionRequest, horizon: number, now: Date, expiresAt: Date,
  ): PredictionResult {
    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      predictionType: request.predictionType,
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      probability: 0,
      confidence: 'VERY_LOW',
      horizon,
      evidence: [],
      explanation: 'Prediction generation failed due to internal error.',
      model: this.MODEL,
      version: this.VERSION,
      generatedAt: now,
      expiresAt,
      status: 'FAILED',
    };
  }

  private computeConfidence(dataPoints: number): 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' {
    if (dataPoints <= 1) return 'VERY_LOW';
    if (dataPoints <= 2) return 'LOW';
    if (dataPoints <= 4) return 'MEDIUM';
    if (dataPoints <= 6) return 'HIGH';
    return 'VERY_HIGH';
  }

  private generateTransferExplanation(probability: number, evidence: Array<{ sourceType: string; sourceId: string; reason: string }>): string {
    const pct = Math.round(probability * 100);
    const evidenceStr = evidence.map(e => e.reason).join('; ');
    if (pct >= 80) return `High transfer failure risk (${pct}%). Multiple indicators suggest significant risk. Evidence: ${evidenceStr}.`;
    if (pct >= 50) return `Moderate transfer failure risk (${pct}%). Some indicators suggest elevated risk. Evidence: ${evidenceStr}.`;
    if (pct >= 30) return `Low-moderate transfer failure risk (${pct}%). Limited risk indicators detected. Evidence: ${evidenceStr}.`;
    return `Low transfer failure risk (${pct}%). No significant risk indicators detected. Evidence: ${evidenceStr}.`;
  }
}

export const predictionEngine = new PredictionEngineService();
