import {
  db,
  baggageStateProjections,
  expectedEvents,
  cases,
  caseSla,
  caseEscalations,
  recoveryPlans,
  tasks,
} from '@airove/db';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from './logger.js';

export type RootCauseSubjectType = 'baggage' | 'case' | 'recovery_plan';

export interface RootCauseCandidate {
  cause: string;
  confidence: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  evidence: Array<{ sourceType: string; sourceId: string; reason: string }>;
  description: string;
}

export interface RootCauseResult {
  id: string;
  organizationId: string;
  subjectType: RootCauseSubjectType;
  subjectId: string;
  candidates: RootCauseCandidate[];
  evidence: Array<{ sourceType: string; sourceId: string; reason: string }>;
  explanation: string;
  confidence: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  generatedAt: Date;
  model: string;
  version: string;
  status: 'COMPLETED' | 'FAILED';
}

interface RootCauseRequest {
  orgId: string;
  subjectType: RootCauseSubjectType;
  subjectId: string;
}

const CONFIDENCE_RANK: Record<string, number> = {
  VERY_LOW: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  VERY_HIGH: 4,
};

function maxConfidence(levels: string[]): 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' {
  let best = 0;
  for (const l of levels) {
    const rank = CONFIDENCE_RANK[l] ?? 0;
    if (rank > best) best = rank;
  }
  return (Object.entries(CONFIDENCE_RANK).find(([, v]) => v === best)?.[0] ?? 'VERY_LOW') as 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
}

class RootCauseService {
  private readonly MODEL = 'deterministic';
  private readonly VERSION = 'heuristic-v1';

  async analyze(request: RootCauseRequest): Promise<RootCauseResult> {
    const now = new Date();

    try {
      switch (request.subjectType) {
        case 'baggage':
          return this.analyzeBaggageRootCause(request, now);
        case 'case':
          return this.analyzeCaseRootCause(request, now);
        case 'recovery_plan':
          return this.analyzeRecoveryRootCause(request, now);
        default:
          return this.noDataResult(request, now);
      }
    } catch (err) {
      logger.error({ err, request }, 'Root cause analysis failed');
      return this.failedResult(request, now);
    }
  }

  private async analyzeBaggageRootCause(request: RootCauseRequest, now: Date): Promise<RootCauseResult> {
    const candidates: RootCauseCandidate[] = [];
    const allEvidence: RootCauseResult['evidence'] = [];

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
    if (!state) {
      return this.noDataResult(request, now);
    }

    const eventCount = (state['eventCount'] as number) ?? 0;
    if (eventCount === 0) {
      candidates.push({
        cause: 'no_tracking_events',
        confidence: 'MEDIUM',
        evidence: [{ sourceType: 'baggage_state', sourceId: state['id'], reason: 'Zero tracking events recorded' }],
        description: 'The baggage has no tracking events, suggesting it was never scanned or the tracking system failed.',
      });
    }

    const lastEventAt = state['lastEventAt'] as Date | null;
    if (lastEventAt) {
      const hoursSince = (now.getTime() - lastEventAt.getTime()) / 3600000;
      if (hoursSince > 12) {
        candidates.push({
          cause: 'tracking_gap',
          confidence: 'MEDIUM',
          evidence: [{ sourceType: 'event_gap', sourceId: state['id'], reason: `${Math.round(hoursSince)} hours since last event` }],
          description: `A ${Math.round(hoursSince)}-hour gap in tracking events suggests the baggage may have been misrouted or a scanner failed.`,
        });
      }
    }

    const overdueEvents = await db
      .select()
      .from(expectedEvents)
      .where(
        and(
          eq(expectedEvents.orgId, request.orgId),
          eq(expectedEvents.baggageId, request.subjectId),
          eq(expectedEvents.status, 'overdue'),
        ),
      )
      .limit(10);

    if (overdueEvents.length > 0) {
      const eventTypes = overdueEvents.map(e => e['expectedType'] as string).filter(Boolean);
      candidates.push({
        cause: 'missed_transfer',
        confidence: overdueEvents.length > 2 ? 'HIGH' : 'MEDIUM',
        evidence: overdueEvents.slice(0, 3).map(e => ({
          sourceType: 'expected_events',
          sourceId: e['id'],
          reason: `Missed ${e['expectedType']} event`,
        })),
        description: `${overdueEvents.length} expected event(s) were missed (${eventTypes.join(', ')}), indicating a likely transfer failure.`,
      });
    }

    const activeCases = await db
      .select()
      .from(cases)
      .where(
        and(
          eq(cases.orgId, request.orgId),
          eq(cases.baggageId, request.subjectId),
          sql`${cases.status} NOT IN ('closed', 'cancelled', 'duplicate')`,
        ),
      )
      .limit(5);

    if (activeCases.length > 1) {
      candidates.push({
        cause: 'recurring_issue',
        confidence: 'LOW',
        evidence: activeCases.map(c => ({
          sourceType: 'cases',
          sourceId: c['id'],
          reason: `Active case: ${c['caseNumber']}`,
        })),
        description: `${activeCases.length} concurrent cases for this baggage suggest a systemic or recurring issue.`,
      });
    }

    for (const ac of activeCases) {
      allEvidence.push({ sourceType: 'cases', sourceId: ac['id'], reason: `Active case ${ac['caseNumber']}` });
    }
    for (const cand of candidates) {
      allEvidence.push(...cand.evidence);
    }

    const topConfidence = candidates.length > 0
      ? maxConfidence(candidates.map(c => c.confidence))
      : 'VERY_LOW';

    const explanation = candidates.length === 0
      ? `No root cause candidates identified for baggage ${request.subjectId}.`
      : `Identified ${candidates.length} root cause candidate(s): ${candidates.map(c => c.cause).join(', ')}.`;

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      subjectType: 'baggage',
      subjectId: request.subjectId,
      candidates,
      evidence: allEvidence,
      explanation,
      confidence: topConfidence,
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'COMPLETED',
    };
  }

  private async analyzeCaseRootCause(request: RootCauseRequest, now: Date): Promise<RootCauseResult> {
    const candidates: RootCauseCandidate[] = [];
    const allEvidence: RootCauseResult['evidence'] = [];

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
      return this.noDataResult(request, now);
    }

    const slaRecord = await db
      .select()
      .from(caseSla)
      .where(
        and(
          eq(caseSla.orgId, request.orgId),
          eq(caseSla.caseId, request.subjectId),
        ),
      )
      .limit(1);

    const sla = slaRecord[0];
    if (sla && sla['resolutionDueAt']) {
      const dueAt = new Date(sla['resolutionDueAt']);
      if (dueAt.getTime() < now.getTime()) {
        candidates.push({
          cause: 'sla_breach_delay',
          confidence: 'HIGH',
          evidence: [{ sourceType: 'case_sla', sourceId: sla['id'], reason: 'SLA breached' }],
          description: 'The case SLA was breached, indicating insufficient response time or resource allocation.',
        });
      }
    }

    const blockedTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.orgId, request.orgId),
          eq(tasks.caseId, request.subjectId),
          eq(tasks.status, 'blocked'),
        ),
      )
      .limit(10);

    if (blockedTasks.length > 0) {
      candidates.push({
        cause: 'blocked_dependencies',
        confidence: 'MEDIUM',
        evidence: blockedTasks.slice(0, 3).map(t => ({
          sourceType: 'tasks',
          sourceId: t['id'],
          reason: `Blocked task: ${t['title']}`,
        })),
        description: `${blockedTasks.length} blocked task(s) indicate unresolved dependencies preventing case resolution.`,
      });
    }

    const escalations = await db
      .select()
      .from(caseEscalations)
      .where(
        and(
          eq(caseEscalations.orgId, request.orgId),
          eq(caseEscalations.caseId, request.subjectId),
          sql`${caseEscalations.status} != 'resolved'`,
        ),
      )
      .limit(5);

    if (escalations.length > 0) {
      const latestLevel = escalations[0]?.['escalationLevel'] as string;
      candidates.push({
        cause: 'insufficient_authority',
        confidence: 'MEDIUM',
        evidence: escalations.slice(0, 3).map(e => ({
          sourceType: 'case_escalations',
          sourceId: e['id'],
          reason: `Escalated to ${e['escalationLevel']}`,
        })),
        description: `${escalations.length} active escalation(s) (current level: ${latestLevel}) suggest the case requires higher authority.`,
      });
    }

    for (const cand of candidates) {
      allEvidence.push(...cand.evidence);
    }

    const topConfidence = candidates.length > 0
      ? maxConfidence(candidates.map(c => c.confidence))
      : 'VERY_LOW';

    const explanation = candidates.length === 0
      ? `No root cause candidates identified for case ${request.subjectId}.`
      : `Identified ${candidates.length} root cause candidate(s): ${candidates.map(c => c.cause).join(', ')}.`;

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      subjectType: 'case',
      subjectId: request.subjectId,
      candidates,
      evidence: allEvidence,
      explanation,
      confidence: topConfidence,
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'COMPLETED',
    };
  }

  private async analyzeRecoveryRootCause(request: RootCauseRequest, now: Date): Promise<RootCauseResult> {
    const candidates: RootCauseCandidate[] = [];
    const allEvidence: RootCauseResult['evidence'] = [];

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
      return this.noDataResult(request, now);
    }

    if (p['slaRemainingMinutes'] !== null && p['slaRemainingMinutes'] !== undefined) {
      const slaMin = p['slaRemainingMinutes'] as number;
      if (slaMin < 0) {
        candidates.push({
          cause: 'sla_timeout',
          confidence: 'HIGH',
          evidence: [{ sourceType: 'recovery_plan', sourceId: p['id'], reason: `SLA breached by ${Math.abs(slaMin)} min` }],
          description: `Recovery SLA breached by ${Math.abs(slaMin)} minutes.`,
        });
      } else if (slaMin < 30) {
        candidates.push({
          cause: 'tight_sla',
          confidence: 'MEDIUM',
          evidence: [{ sourceType: 'recovery_plan', sourceId: p['id'], reason: `Only ${slaMin} min SLA remaining` }],
          description: `Only ${slaMin} minutes of SLA remain, creating high pressure.`,
        });
      }
    }

    const ageHours = (now.getTime() - new Date(p['createdAt']).getTime()) / 3600000;
    if (ageHours > 12 && p['status'] === 'in_progress') {
      candidates.push({
        cause: 'complexity_underestimation',
        confidence: 'MEDIUM',
        evidence: [{ sourceType: 'recovery_plan', sourceId: p['id'], reason: `Active for ${Math.round(ageHours)}h` }],
        description: `Recovery plan active for ${Math.round(ageHours)} hours suggests underestimated complexity.`,
      });
    }

    if (p['riskLevel'] === 'critical' || p['riskLevel'] === 'high') {
      candidates.push({
        cause: 'high_inherent_risk',
        confidence: 'LOW',
        evidence: [{ sourceType: 'recovery_plan', sourceId: p['id'], reason: `Risk level: ${p['riskLevel']}` }],
        description: `The recovery plan was flagged as ${p['riskLevel']} risk.`,
      });
    }

    for (const cand of candidates) {
      allEvidence.push(...cand.evidence);
    }

    const topConfidence = candidates.length > 0
      ? maxConfidence(candidates.map(c => c.confidence))
      : 'VERY_LOW';

    const explanation = candidates.length === 0
      ? `No root cause candidates identified for recovery plan ${request.subjectId}.`
      : `Identified ${candidates.length} root cause candidate(s): ${candidates.map(c => c.cause).join(', ')}.`;

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      subjectType: 'recovery_plan',
      subjectId: request.subjectId,
      candidates,
      evidence: allEvidence,
      explanation,
      confidence: topConfidence,
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'COMPLETED',
    };
  }

  private noDataResult(request: RootCauseRequest, now: Date): RootCauseResult {
    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      candidates: [],
      evidence: [],
      explanation: `Insufficient data for root cause analysis of ${request.subjectType} ${request.subjectId}.`,
      confidence: 'VERY_LOW',
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'COMPLETED',
    };
  }

  private failedResult(request: RootCauseRequest, now: Date): RootCauseResult {
    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      candidates: [],
      evidence: [],
      explanation: 'Root cause analysis failed due to internal error.',
      confidence: 'VERY_LOW',
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'FAILED',
    };
  }
}

export const rootCauseService = new RootCauseService();
