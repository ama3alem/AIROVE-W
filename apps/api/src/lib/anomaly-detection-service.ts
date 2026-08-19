import {
  db,
  baggageStateProjections,
  expectedEvents,
  cases,
  caseSla,
  recoveryPlans,
  tasks,
} from '@airove/db';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from './logger';

export type AnomalySubjectType = 'baggage' | 'case' | 'recovery_plan' | 'airport';

export interface AnomalyResult {
  id: string;
  organizationId: string;
  anomalyType: string;
  subjectType: AnomalySubjectType;
  subjectId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
  expectedBehavior: string;
  observedBehavior: string;
  evidence: Array<{ sourceType: string; sourceId: string; reason: string }>;
  explanation: string;
  confidence: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  generatedAt: Date;
  model: string;
  version: string;
  status: 'COMPLETED' | 'FAILED';
}

interface AnomalyRequest {
  orgId: string;
  subjectType: AnomalySubjectType;
  subjectId: string;
  scanTypes?: string[];
}

class AnomalyDetectionService {
  private readonly MODEL = 'deterministic';
  private readonly VERSION = 'heuristic-v1';

  async detect(request: AnomalyRequest): Promise<AnomalyResult[]> {
    const now = new Date();
    const scanTypes = request.scanTypes ?? ['all'];

    try {
      const shouldScan = (type: string) => scanTypes.includes('all') || scanTypes.includes(type);
      const anomalies: AnomalyResult[] = [];

      switch (request.subjectType) {
        case 'baggage':
          if (shouldScan('overdue_events')) {
            const overdueAnomaly = await this.detectOverdueEvents(request, now);
            if (overdueAnomaly) anomalies.push(overdueAnomaly);
          }
          if (shouldScan('stale_tracking')) {
            const staleAnomaly = await this.detectStaleTracking(request, now);
            if (staleAnomaly) anomalies.push(staleAnomaly);
          }
          if (shouldScan('event_gap')) {
            const gapAnomaly = await this.detectEventGap(request, now);
            if (gapAnomaly) anomalies.push(gapAnomaly);
          }
          break;

        case 'case':
          if (shouldScan('long_running')) {
            const longRunning = await this.detectLongRunningCase(request, now);
            if (longRunning) anomalies.push(longRunning);
          }
          if (shouldScan('sla_breach')) {
            const slaAnomaly = await this.detectSLABreach(request, now);
            if (slaAnomaly) anomalies.push(slaAnomaly);
          }
          if (shouldScan('stalled_case')) {
            const stalled = await this.detectStalledCase(request, now);
            if (stalled) anomalies.push(stalled);
          }
          break;

        case 'recovery_plan':
          if (shouldScan('long_running')) {
            const longPlan = await this.detectLongRunningRecovery(request, now);
            if (longPlan) anomalies.push(longPlan);
          }
          if (shouldScan('sla_breach')) {
            const slaPlan = await this.detectRecoverySLABreach(request, now);
            if (slaPlan) anomalies.push(slaPlan);
          }
          break;

        case 'airport':
          if (shouldScan('volume_spike')) {
            const volume = await this.detectVolumeSpike(request, now);
            if (volume) anomalies.push(volume);
          }
          break;
      }

      return anomalies;
    } catch (err) {
      logger.error({ err, request }, 'Anomaly detection failed');
      return [this.failedAnomaly(request, now)];
    }
  }

  private async detectOverdueEvents(request: AnomalyRequest, now: Date): Promise<AnomalyResult | null> {
    const evidence: AnomalyResult['evidence'] = [];

    const overdue = await db
      .select()
      .from(expectedEvents)
      .where(
        and(
          eq(expectedEvents.orgId, request.orgId),
          eq(expectedEvents.baggageId, request.subjectId),
          eq(expectedEvents.status, 'overdue'),
        ),
      )
      .limit(20);

    if (overdue.length === 0) return null;

    const maxOverdueMinutes = overdue.reduce((max, evt) => {
      const expected = new Date(evt['expectedAt'] as Date);
      const overdueMin = (now.getTime() - expected.getTime()) / 60000;
      return Math.max(max, overdueMin);
    }, 0);

    for (const evt of overdue.slice(0, 3)) {
      evidence.push({ sourceType: 'expected_events', sourceId: evt['id'], reason: `Overdue event: ${evt['expectedType']}` });
    }

    const score = Math.min(1, overdue.length * 0.2 + (maxOverdueMinutes > 120 ? 0.3 : 0));

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      anomalyType: 'overdue_events',
      subjectType: 'baggage',
      subjectId: request.subjectId,
      severity: this.scoreToSeverity(score),
      score,
      expectedBehavior: `${overdue.length} expected event(s) should have occurred`,
      observedBehavior: `${overdue.length} event(s) are overdue (max ${Math.round(maxOverdueMinutes)} min past expected)`,
      evidence,
      explanation: `${overdue.length} expected event(s) overdue for baggage ${request.subjectId}. Max delay: ${Math.round(maxOverdueMinutes)} minutes.`,
      confidence: evidence.length >= 2 ? 'HIGH' : 'MEDIUM',
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'COMPLETED',
    };
  }

  private async detectStaleTracking(request: AnomalyRequest, now: Date): Promise<AnomalyResult | null> {
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
    if (!state || !state['lastEventAt']) return null;

    const hoursSinceLastEvent = (now.getTime() - new Date(state['lastEventAt']).getTime()) / 3600000;
    if (hoursSinceLastEvent < 6) return null;

    const score = Math.min(1, hoursSinceLastEvent / 48);

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      anomalyType: 'stale_tracking',
      subjectType: 'baggage',
      subjectId: request.subjectId,
      severity: this.scoreToSeverity(score),
      score,
      expectedBehavior: 'Regular tracking events (at least every few hours)',
      observedBehavior: `No tracking events for ${Math.round(hoursSinceLastEvent)} hours`,
      evidence: [{ sourceType: 'baggage_state', sourceId: state['id'], reason: `Last event ${Math.round(hoursSinceLastEvent)}h ago` }],
      explanation: `Baggage ${request.subjectId} has not received a tracking event in ${Math.round(hoursSinceLastEvent)} hours.`,
      confidence: hoursSinceLastEvent > 24 ? 'HIGH' : 'MEDIUM',
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'COMPLETED',
    };
  }

  private async detectEventGap(request: AnomalyRequest, now: Date): Promise<AnomalyResult | null> {
    const state = await db
      .select()
      .from(baggageStateProjections)
      .where(
        and(
          eq(baggageStateProjections.orgId, request.orgId),
          eq(baggageStateProjections.baggageId, request.subjectId),
        ),
      )
      .limit(1);

    const s = state[0];
    if (!s) return null;

    const eventCount = (s['eventCount'] as number) ?? 0;
    const updatedAt = s['updatedAt'] as Date;
    if (!updatedAt) return null;

    const ageHours = (now.getTime() - new Date(updatedAt).getTime()) / 3600000;
    const expectedEventCount = Math.max(1, Math.floor(ageHours / 2));
    const ratio = eventCount / expectedEventCount;

    if (ratio > 0.5 || ageHours < 4) return null;

    const score = Math.min(1, 1 - ratio);

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      anomalyType: 'event_gap',
      subjectType: 'baggage',
      subjectId: request.subjectId,
      severity: this.scoreToSeverity(score),
      score,
      expectedBehavior: `Approximately ${expectedEventCount} events over ${Math.round(ageHours)} hours`,
      observedBehavior: `Only ${eventCount} event(s) recorded in ${Math.round(ageHours)} hours`,
      evidence: [{ sourceType: 'baggage_state', sourceId: s['id'], reason: `${eventCount}/${expectedEventCount} expected events` }],
      explanation: `Baggage ${request.subjectId} has significantly fewer tracking events than expected: ${eventCount} of ~${expectedEventCount} over ${Math.round(ageHours)} hours.`,
      confidence: 'MEDIUM',
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'COMPLETED',
    };
  }

  private async detectLongRunningCase(request: AnomalyRequest, now: Date): Promise<AnomalyResult | null> {
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
    if (!c || c['status'] === 'closed' || c['status'] === 'cancelled') return null;

    const ageHours = (now.getTime() - new Date(c['createdAt']).getTime()) / 3600000;
    if (ageHours < 24) return null;

    const score = Math.min(1, ageHours / 120);

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      anomalyType: 'long_running_case',
      subjectType: 'case',
      subjectId: request.subjectId,
      severity: this.scoreToSeverity(score),
      score,
      expectedBehavior: 'Cases typically resolved within 24 hours',
      observedBehavior: `Case has been open for ${Math.round(ageHours)} hours`,
      evidence: [{ sourceType: 'cases', sourceId: c['id'], reason: `Open for ${Math.round(ageHours)}h, status: ${c['status']}` }],
      explanation: `Case ${request.subjectId} has been open for ${Math.round(ageHours)} hours, exceeding the typical resolution window.`,
      confidence: ageHours > 48 ? 'HIGH' : 'MEDIUM',
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'COMPLETED',
    };
  }

  private async detectSLABreach(request: AnomalyRequest, now: Date): Promise<AnomalyResult | null> {
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
    if (!sla || !sla['resolutionDueAt']) return null;

    const dueAt = new Date(sla['resolutionDueAt']);
    if (dueAt.getTime() > now.getTime()) return null;

    const breachMinutes = (now.getTime() - dueAt.getTime()) / 60000;
    const score = Math.min(1, breachMinutes / 120);

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      anomalyType: 'sla_breach',
      subjectType: 'case',
      subjectId: request.subjectId,
      severity: this.scoreToSeverity(score),
      score,
      expectedBehavior: `SLA resolution by ${dueAt.toISOString()}`,
      observedBehavior: `SLA breached by ${Math.round(breachMinutes)} minutes`,
      evidence: [{ sourceType: 'case_sla', sourceId: sla['id'], reason: `Breached ${Math.round(breachMinutes)} min ago` }],
      explanation: `SLA for case ${request.subjectId} was breached ${Math.round(breachMinutes)} minutes ago.`,
      confidence: 'HIGH',
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'COMPLETED',
    };
  }

  private async detectStalledCase(request: AnomalyRequest, now: Date): Promise<AnomalyResult | null> {
    const caseTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.orgId, request.orgId),
          eq(tasks.caseId, request.subjectId),
          sql`${tasks.status} IN ('pending', 'in_progress')`,
        ),
      )
      .limit(20);

    if (caseTasks.length === 0) return null;

    const staleTasks = caseTasks.filter((t) => {
      const updatedAt = t['updatedAt'] as Date | null;
      if (!updatedAt) return true;
      const hoursSinceUpdate = (now.getTime() - new Date(updatedAt).getTime()) / 3600000;
      return hoursSinceUpdate > 12;
    });

    if (staleTasks.length === 0) return null;

    const score = Math.min(1, staleTasks.length * 0.25);

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      anomalyType: 'stalled_tasks',
      subjectType: 'case',
      subjectId: request.subjectId,
      severity: this.scoreToSeverity(score),
      score,
      expectedBehavior: 'Tasks updated regularly while case is active',
      observedBehavior: `${staleTasks.length} of ${caseTasks.length} tasks have not been updated in 12+ hours`,
      evidence: staleTasks.slice(0, 3).map(t => ({ sourceType: 'tasks', sourceId: t['id'], reason: `Task stale` })),
      explanation: `Case ${request.subjectId} has ${staleTasks.length} task(s) that appear stalled (no updates in 12+ hours).`,
      confidence: 'MEDIUM',
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'COMPLETED',
    };
  }

  private async detectLongRunningRecovery(request: AnomalyRequest, now: Date): Promise<AnomalyResult | null> {
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
    if (!p || p['status'] === 'completed' || p['status'] === 'cancelled') return null;

    const ageHours = (now.getTime() - new Date(p['createdAt']).getTime()) / 3600000;
    if (ageHours < 12) return null;

    const score = Math.min(1, ageHours / 72);

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      anomalyType: 'long_running_recovery',
      subjectType: 'recovery_plan',
      subjectId: request.subjectId,
      severity: this.scoreToSeverity(score),
      score,
      expectedBehavior: 'Recovery plans typically completed within 12 hours',
      observedBehavior: `Recovery plan active for ${Math.round(ageHours)} hours`,
      evidence: [{ sourceType: 'recovery_plan', sourceId: p['id'], reason: `Active for ${Math.round(ageHours)}h` }],
      explanation: `Recovery plan ${request.subjectId} has been active for ${Math.round(ageHours)} hours.`,
      confidence: ageHours > 24 ? 'HIGH' : 'MEDIUM',
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'COMPLETED',
    };
  }

  private async detectRecoverySLABreach(request: AnomalyRequest, now: Date): Promise<AnomalyResult | null> {
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
    if (!p || p['slaRemainingMinutes'] === null || p['slaRemainingMinutes'] === undefined) return null;
    if ((p['slaRemainingMinutes'] as number) >= 0) return null;

    const breachMinutes = Math.abs(p['slaRemainingMinutes'] as number);
    const score = Math.min(1, breachMinutes / 120);

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      anomalyType: 'recovery_sla_breach',
      subjectType: 'recovery_plan',
      subjectId: request.subjectId,
      severity: this.scoreToSeverity(score),
      score,
      expectedBehavior: 'Recovery SLA met',
      observedBehavior: `Recovery SLA breached by ${Math.round(breachMinutes)} minutes`,
      evidence: [{ sourceType: 'recovery_plan', sourceId: p['id'], reason: `SLA breached by ${Math.round(breachMinutes)} min` }],
      explanation: `Recovery plan ${request.subjectId} SLA breached by ${Math.round(breachMinutes)} minutes.`,
      confidence: 'HIGH',
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'COMPLETED',
    };
  }

  private async detectVolumeSpike(request: AnomalyRequest, now: Date): Promise<AnomalyResult | null> {
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
    if (caseCount < 5) return null;

    const score = Math.min(1, caseCount / 20);

    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      anomalyType: 'volume_spike',
      subjectType: 'airport',
      subjectId: airportCode,
      severity: this.scoreToSeverity(score),
      score,
      expectedBehavior: 'Typically fewer than 5 active cases per airport',
      observedBehavior: `${caseCount} active cases at airport ${airportCode}`,
      evidence: [{ sourceType: 'cases', sourceId: airportCode, reason: `${caseCount} active cases` }],
      explanation: `Airport ${airportCode} has ${caseCount} active cases, significantly above the typical volume.`,
      confidence: caseCount > 10 ? 'HIGH' : 'MEDIUM',
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'COMPLETED',
    };
  }

  private failedAnomaly(request: AnomalyRequest, now: Date): AnomalyResult {
    return {
      id: crypto.randomUUID(),
      organizationId: request.orgId,
      anomalyType: 'detection_error',
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      severity: 'LOW',
      score: 0,
      expectedBehavior: 'Anomaly detection to complete successfully',
      observedBehavior: 'Anomaly detection failed due to internal error',
      evidence: [],
      explanation: 'Anomaly detection failed due to internal error.',
      confidence: 'VERY_LOW',
      generatedAt: now,
      model: this.MODEL,
      version: this.VERSION,
      status: 'FAILED',
    };
  }

  private scoreToSeverity(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= 0.75) return 'CRITICAL';
    if (score >= 0.5) return 'HIGH';
    if (score >= 0.25) return 'MEDIUM';
    return 'LOW';
  }
}

export const anomalyDetectionService = new AnomalyDetectionService();
