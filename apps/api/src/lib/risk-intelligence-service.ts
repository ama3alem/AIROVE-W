import {
  db,
  baggageStateProjections,
  cases,
  caseSla,
  caseEscalations,
  recoveryPlans,
  expectedEvents,
  tasks,
} from '@airove/db';
import { eq, and, sql, desc } from 'drizzle-orm';
import { logger } from './logger';

export type RiskSubjectType = 'baggage' | 'case' | 'recovery_plan' | 'airport';

export interface RiskFactor {
  name: string;
  weight: number;
  description: string;
}

export interface RiskAssessmentResult {
  id: string;
  organizationId: string;
  subjectType: RiskSubjectType;
  subjectId: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: RiskFactor[];
  evidence: Array<{ sourceType: string; sourceId: string; reason: string }>;
  explanation: string;
  confidence: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  generatedAt: Date;
  model: string;
  version: string;
  status: 'COMPLETED' | 'FAILED';
}

interface RiskRequest {
  orgId: string;
  subjectType: RiskSubjectType;
  subjectId: string;
}

class RiskIntelligenceService {
  private readonly MODEL = 'deterministic';
  private readonly VERSION = 'heuristic-v1';

  async assessRisk(request: RiskRequest): Promise<RiskAssessmentResult> {
    const now = new Date();

    try {
      switch (request.subjectType) {
        case 'baggage':
          return this.assessBaggageRisk(request, now);
        case 'case':
          return this.assessCaseRisk(request, now);
        case 'recovery_plan':
          return this.assessRecoveryRisk(request, now);
        case 'airport':
          return this.assessAirportRisk(request, now);
        default:
          return this.genericRisk(request, now);
      }
    } catch (err) {
      logger.error({ err, request }, 'Risk assessment failed');
      return this.failedRisk(request, now);
    }
  }

  private async assessBaggageRisk(request: RiskRequest, now: Date): Promise<RiskAssessmentResult> {
    const factors: RiskFactor[] = [];
    const evidence: Array<{ sourceType: string; sourceId: string; reason: string }> = [];

    const projection = await db
      .select()
      .from(baggageStateProjections)
      .where(
        and(
          eq(baggageStateProjections.orgId, request.orgId),
          eq(baggageStateProjections.baggageId, request.subjectId),
        ),
      )
      .limit(1);

    const state = projection[0];
    if (state) {
      const eventCount = (state['eventCount'] as number) ?? 0;
      if (eventCount === 0) {
        factors.push({ name: 'no_events', weight: 0.3, description: 'No tracking events recorded' });
        evidence.push({ sourceType: 'baggage_state', sourceId: state['id'], reason: 'Zero events recorded' });
      }

      const lastEventAt = state['lastEventAt'] as Date | null;
      if (lastEventAt) {
        const hoursSince = (now.getTime() - lastEventAt.getTime()) / 3600000;
        if (hoursSince > 12) {
          const weight = Math.min(0.4, 0.1 + hoursSince * 0.01);
          factors.push({ name: 'stale_events', weight, description: `Last event ${Math.round(hoursSince)}h ago` });
          evidence.push({ sourceType: 'event_gap', sourceId: state['id'], reason: `${Math.round(hoursSince)} hours since last event` });
        }
      }
    }

    const activeCases = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(cases)
      .where(
        and(
          eq(cases.orgId, request.orgId),
          eq(cases.baggageId, request.subjectId),
          sql`${cases.status} NOT IN ('closed', 'cancelled', 'duplicate')`,
        ),
      )
      .limit(1);

    const openCaseCount = activeCases[0]?.['cnt'] ?? 0;
    if (openCaseCount > 0) {
      factors.push({ name: 'active_cases', weight: Math.min(0.3, openCaseCount * 0.15), description: `${openCaseCount} open case(s)` });
      evidence.push({ sourceType: 'cases', sourceId: request.subjectId, reason: `${openCaseCount} active case(s)` });
    }

    const overdueEvents = await db
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

    const overdueCount = overdueEvents[0]?.['cnt'] ?? 0;
    if (overdueCount > 0) {
      factors.push({ name: 'overdue_events', weight: Math.min(0.35, overdueCount * 0.15), description: `${overdueCount} overdue expected event(s)` });
      evidence.push({ sourceType: 'expected_events', sourceId: request.subjectId, reason: `${overdueCount} overdue events` });
    }

    const plans = await db
      .select()
      .from(recoveryPlans)
      .where(
        and(
          eq(recoveryPlans.orgId, request.orgId),
          eq(recoveryPlans.baggageId, request.subjectId),
          sql`${recoveryPlans.status} NOT IN ('completed', 'cancelled')`,
        ),
      )
      .limit(3);

    if (plans.length > 0) {
      factors.push({ name: 'active_recovery', weight: 0.15, description: 'Active recovery plan in progress' });
      for (const p of plans) {
        evidence.push({ sourceType: 'recovery_plan', sourceId: p['id'], reason: `Active plan: ${p['status']}` });
      }
    }

    return this.buildResult(request, factors, evidence, now);
  }

  private async assessCaseRisk(request: RiskRequest, now: Date): Promise<RiskAssessmentResult> {
    const factors: RiskFactor[] = [];
    const evidence: Array<{ sourceType: string; sourceId: string; reason: string }> = [];

    const caseRecord = await db
      .select()
      .from(cases)
      .where(
        and(
          eq(cases.orgId, request.orgId),
          eq(cases.id, request.subjectId),
        ),
      )
      .limit(1);

    const c = caseRecord[0];
    if (!c) {
      return this.buildResult(request, [{ name: 'not_found', weight: 0.5, description: 'Case not found' }], evidence, now);
    }

    const ageHours = (now.getTime() - new Date(c['createdAt']).getTime()) / 3600000;
    if (ageHours > 48) {
      factors.push({ name: 'case_age_critical', weight: 0.35, description: `Case open for ${Math.round(ageHours)}h` });
    } else if (ageHours > 24) {
      factors.push({ name: 'case_age_high', weight: 0.25, description: `Case open for ${Math.round(ageHours)}h` });
    } else if (ageHours > 8) {
      factors.push({ name: 'case_age_moderate', weight: 0.1, description: `Case open for ${Math.round(ageHours)}h` });
    }
    evidence.push({ sourceType: 'cases', sourceId: c['id'], reason: `Age: ${Math.round(ageHours)}h, priority: ${c['priority']}` });

    if (c['priority'] === 'critical' || c['priority'] === 'high') {
      factors.push({ name: 'high_priority', weight: 0.2, description: `Priority: ${c['priority']}` });
    }

    const slaRecord = await db
      .select()
      .from(caseSla)
      .where(
        and(
          eq(caseSla.orgId, request.orgId),
          eq(caseSla.caseId, request.subjectId),
          eq(caseSla.status, 'active'),
        ),
      )
      .limit(1);

    const sla = slaRecord[0];
    if (sla && sla['resolutionDueAt']) {
      const minutesRemaining = (new Date(sla['resolutionDueAt']).getTime() - now.getTime()) / 60000;
      if (minutesRemaining < 0) {
        factors.push({ name: 'sla_breached', weight: 0.4, description: 'SLA already breached' });
        evidence.push({ sourceType: 'case_sla', sourceId: sla['id'], reason: 'SLA breached' });
      } else if (minutesRemaining < 60) {
        factors.push({ name: 'sla_critical', weight: 0.3, description: `${Math.round(minutesRemaining)} min SLA remaining` });
        evidence.push({ sourceType: 'case_sla', sourceId: sla['id'], reason: `${Math.round(minutesRemaining)} min remaining` });
      } else if (minutesRemaining < 180) {
        factors.push({ name: 'sla_warning', weight: 0.15, description: `${Math.round(minutesRemaining)} min SLA remaining` });
      }
    }

    const escalations = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(caseEscalations)
      .where(
        and(
          eq(caseEscalations.orgId, request.orgId),
          eq(caseEscalations.caseId, request.subjectId),
          sql`${caseEscalations.status} != 'resolved'`,
        ),
      )
      .limit(1);

    const escCount = escalations[0]?.['cnt'] ?? 0;
    if (escCount > 0) {
      factors.push({ name: 'active_escalations', weight: Math.min(0.3, escCount * 0.15), description: `${escCount} active escalation(s)` });
      evidence.push({ sourceType: 'case_escalations', sourceId: request.subjectId, reason: `${escCount} active escalations` });
    }

    const pendingTasks = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(tasks)
      .where(
        and(
          eq(tasks.orgId, request.orgId),
          eq(tasks.caseId, request.subjectId),
          eq(tasks.status, 'pending'),
        ),
      )
      .limit(1);

    const pendingCount = pendingTasks[0]?.['cnt'] ?? 0;
    const blockedTasks = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(tasks)
      .where(
        and(
          eq(tasks.orgId, request.orgId),
          eq(tasks.caseId, request.subjectId),
          eq(tasks.status, 'blocked'),
        ),
      )
      .limit(1);

    const blockedCount = blockedTasks[0]?.['cnt'] ?? 0;
    if (blockedCount > 0) {
      factors.push({ name: 'blocked_tasks', weight: Math.min(0.25, blockedCount * 0.12), description: `${blockedCount} blocked task(s)` });
      evidence.push({ sourceType: 'tasks', sourceId: request.subjectId, reason: `${blockedCount} blocked, ${pendingCount} pending tasks` });
    }

    return this.buildResult(request, factors, evidence, now);
  }

  private async assessRecoveryRisk(request: RiskRequest, now: Date): Promise<RiskAssessmentResult> {
    const factors: RiskFactor[] = [];
    const evidence: Array<{ sourceType: string; sourceId: string; reason: string }> = [];

    const plan = await db
      .select()
      .from(recoveryPlans)
      .where(
        and(
          eq(recoveryPlans.orgId, request.orgId),
          eq(recoveryPlans.id, request.subjectId),
        ),
      )
      .limit(1);

    const p = plan[0];
    if (!p) {
      return this.buildResult(request, [{ name: 'not_found', weight: 0.5, description: 'Recovery plan not found' }], evidence, now);
    }

    evidence.push({ sourceType: 'recovery_plan', sourceId: p['id'], reason: `Status: ${p['status']}, risk: ${p['riskLevel'] ?? 'unknown'}` });

    if (p['riskLevel'] === 'critical' || p['riskLevel'] === 'high') {
      factors.push({ name: 'declared_risk', weight: 0.3, description: `Plan risk level: ${p['riskLevel']}` });
    }

    if (p['slaRemainingMinutes'] !== null && p['slaRemainingMinutes'] !== undefined) {
      const slaMin = p['slaRemainingMinutes'] as number;
      if (slaMin < 30) {
        factors.push({ name: 'sla_imminent', weight: 0.4, description: `${slaMin} min SLA remaining` });
      } else if (slaMin < 120) {
        factors.push({ name: 'sla_tight', weight: 0.25, description: `${slaMin} min SLA remaining` });
      }
      evidence.push({ sourceType: 'sla_remaining', sourceId: p['id'], reason: `${slaMin} minutes remaining` });
    }

    const planAgeHours = (now.getTime() - new Date(p['createdAt']).getTime()) / 3600000;
    if (planAgeHours > 24 && p['status'] === 'in_progress') {
      factors.push({ name: 'long_running', weight: 0.2, description: `Plan active for ${Math.round(planAgeHours)}h` });
    }

    return this.buildResult(request, factors, evidence, now);
  }

  private async assessAirportRisk(request: RiskRequest, now: Date): Promise<RiskAssessmentResult> {
    const factors: RiskFactor[] = [];
    const evidence: Array<{ sourceType: string; sourceId: string; reason: string }> = [];
    const airportCode = request.subjectId;

    const activeCases = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(cases)
      .where(
        and(
          eq(cases.orgId, request.orgId),
          sql`${cases.status} NOT IN ('closed', 'cancelled', 'duplicate')`,
          sql`EXISTS (SELECT 1 FROM baggage WHERE baggage.id = ${cases.baggageId} AND baggage.current_location = ${airportCode})`,
        ),
      )
      .limit(1);

    const caseCount = activeCases[0]?.['cnt'] ?? 0;
    if (caseCount > 5) {
      factors.push({ name: 'high_case_volume', weight: 0.3, description: `${caseCount} active cases at airport` });
    } else if (caseCount > 2) {
      factors.push({ name: 'moderate_case_volume', weight: 0.15, description: `${caseCount} active cases at airport` });
    }
    if (caseCount > 0) {
      evidence.push({ sourceType: 'cases', sourceId: airportCode, reason: `${caseCount} active cases` });
    }

    const activeRecoveries = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(recoveryPlans)
      .where(
        and(
          eq(recoveryPlans.orgId, request.orgId),
          sql`(${recoveryPlans.origin} = ${airportCode} OR ${recoveryPlans.destination} = ${airportCode} OR ${recoveryPlans.currentLocation} = ${airportCode})`,
          sql`${recoveryPlans.status} NOT IN ('completed', 'cancelled')`,
        ),
      )
      .limit(1);

    const recoveryCount = activeRecoveries[0]?.['cnt'] ?? 0;
    if (recoveryCount > 3) {
      factors.push({ name: 'high_recovery_volume', weight: 0.25, description: `${recoveryCount} active recoveries` });
    } else if (recoveryCount > 1) {
      factors.push({ name: 'moderate_recovery_volume', weight: 0.1, description: `${recoveryCount} active recoveries` });
    }
    if (recoveryCount > 0) {
      evidence.push({ sourceType: 'recovery_plans', sourceId: airportCode, reason: `${recoveryCount} active recovery plans` });
    }

    return this.buildResult(request, factors, evidence, now);
  }

  private buildResult(
    request: RiskRequest,
    factors: RiskFactor[],
    evidence: Array<{ sourceType: string; sourceId: string; reason: string }>,
    now: Date,
  ): RiskAssessmentResult {
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const score = Math.min(1, totalWeight);

    let riskLevel: RiskAssessmentResult['riskLevel'];
    if (score >= 0.7) riskLevel = 'CRITICAL';
    else if (score >= 0.45) riskLevel = 'HIGH';
    else if (score >= 0.2) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';

    const confidence = this.computeConfidence(factors.length, evidence.length);
    const factorNames = factors.map(f => f.name).join(', ');
    const explanation = factors.length === 0
      ? `No risk factors detected for ${request.subjectType} ${request.subjectId}.`
      : `Risk assessed as ${riskLevel} (score: ${Math.round(score * 100)}%) based on ${factors.length} factor(s): ${factorNames}.`;

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      riskLevel,
      factors,
      evidence,
      explanation,
      confidence,
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'COMPLETED',
    };
  }

  private genericRisk(request: RiskRequest, now: Date): RiskAssessmentResult {
    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      riskLevel: 'LOW',
      factors: [],
      evidence: [],
      explanation: `Insufficient data for risk assessment of ${request.subjectType} ${request.subjectId}.`,
      confidence: 'VERY_LOW',
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'COMPLETED',
    };
  }

  private failedRisk(request: RiskRequest, now: Date): RiskAssessmentResult {
    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      riskLevel: 'LOW',
      factors: [],
      evidence: [],
      explanation: 'Risk assessment failed due to internal error.',
      confidence: 'VERY_LOW',
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'FAILED',
    };
  }

  private computeConfidence(factors: number, evidenceCount: number): 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' {
    const score = factors + evidenceCount;
    if (score <= 1) return 'VERY_LOW';
    if (score <= 3) return 'LOW';
    if (score <= 5) return 'MEDIUM';
    if (score <= 8) return 'HIGH';
    return 'VERY_HIGH';
  }
}

export const riskIntelligenceService = new RiskIntelligenceService();
