import {
  db,
  baggageStateProjections,
  expectedEvents,
  cases,
  tasks,
  caseEscalations,
  caseSla,
  recoveryPlans,
  analyticsSnapshots,
  recoveryProviders,
} from '@airove/db';
import { eq, and, sql, desc, asc } from 'drizzle-orm';
import { logger } from './logger';

export interface FeatureSet {
  subjectType: string;
  subjectId: string;
  features: Record<string, number | string | boolean>;
  featureVersion: string;
  generatedAt: Date;
  evidence: Array<{ sourceType: string; sourceId: string; reason: string }>;
}

const FEATURE_VERSION = '1.0.0';
const UNCERTAINTY_DEFAULT = -1;

function minutesSince(date: Date | null): number {
  if (!date) return UNCERTAINTY_DEFAULT;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60)));
}

export class AIFeatureService {
  async gatherBaggageFeatures(orgId: string, baggageId: string): Promise<FeatureSet> {
    const evidence: FeatureSet['evidence'] = [];
    const features: Record<string, number | string | boolean> = {};

    try {
      const projection = await db.query.baggageStateProjections.findFirst({
        where: eq(baggageStateProjections.baggageId, baggageId),
      });

      if (projection) {
        features['current_state'] = projection['currentState'] ?? 'unknown';
        features['event_count'] = projection['eventCount'] ?? 0;
        evidence.push({
          sourceType: 'baggage_state_projection',
          sourceId: projection['id'] as string,
          reason: 'Current state and event count from projection',
        });
      } else {
        features['current_state'] = 'unknown';
        features['event_count'] = UNCERTAINTY_DEFAULT;
      }

      const nextExpected = await db.query.expectedEvents.findFirst({
        where: and(
          eq(expectedEvents.baggageId, baggageId),
          eq(expectedEvents.status, 'expected'),
        ),
        orderBy: [asc(expectedEvents.expectedAt)],
      });

      if (nextExpected) {
        const connectionMargin = minutesSince(nextExpected['expectedAt'] as Date | null);
        features['connection_margin'] = connectionMargin;
        features['expected_event_type'] = (nextExpected['expectedType'] as string) ?? 'unknown';
        features['expected_event_overdue'] = connectionMargin < 0;
        evidence.push({
          sourceType: 'expected_events',
          sourceId: nextExpected['id'] as string,
          reason: 'Next expected event for connection margin',
        });
      } else {
        features['connection_margin'] = UNCERTAINTY_DEFAULT;
        features['expected_event_type'] = 'none';
        features['expected_event_overdue'] = false;
      }

      const activeCases = await db.query.cases.findMany({
        where: and(
          eq(cases.baggageId, baggageId),
          eq(cases.orgId, orgId),
          sql`${cases.status} NOT IN ('closed', 'cancelled', 'duplicate')`,
        ),
        orderBy: [desc(cases.createdAt)],
      });

      features['has_active_cases'] = activeCases.length > 0;
      features['active_case_count'] = activeCases.length;
      for (const c of activeCases) {
        evidence.push({
          sourceType: 'cases',
          sourceId: c['id'] as string,
          reason: `Active case: ${c['caseNumber']}`,
        });
      }

      const escalations = await db.query.caseEscalations.findMany({
        where: and(
          eq(caseEscalations.orgId, orgId),
          sql`EXISTS (SELECT 1 FROM cases WHERE cases.id = ${caseEscalations.caseId} AND cases.baggage_id = ${baggageId})`,
        ),
      });

      const activeEscalations = escalations.filter((e) => e['status'] !== 'resolved');
      features['has_escalations'] = activeEscalations.length > 0;
      features['escalation_count'] = activeEscalations.length;
      for (const e of activeEscalations) {
        evidence.push({
          sourceType: 'case_escalations',
          sourceId: e['id'] as string,
          reason: `Active escalation at level: ${e['escalationLevel']}`,
        });
      }

      const relatedCases = activeCases.map((c) => c['id'] as string);
      let slaMinutesRemaining = UNCERTAINTY_DEFAULT;
      if (relatedCases.length > 0) {
        const slaRecord = await db.query.caseSla.findFirst({
          where: and(
            eq(caseSla.orgId, orgId),
            sql`${caseSla.caseId} IN ${sql`${relatedCases}`}`,
            eq(caseSla.status, 'active'),
          ),
        });

        if (slaRecord) {
          const resolutionDue = slaRecord['resolutionDueAt'] as Date | null;
          if (resolutionDue) {
            slaMinutesRemaining = Math.floor((resolutionDue.getTime() - Date.now()) / (1000 * 60));
          }
          features['sla_margin'] = slaMinutesRemaining;
          features['sla_warning_triggered'] = slaRecord['warningTriggeredAt'] !== null;
          features['sla_breach_triggered'] = slaRecord['breachTriggeredAt'] !== null;
          evidence.push({
            sourceType: 'case_sla',
            sourceId: slaRecord['id'] as string,
            reason: 'SLA status for active case',
          });
        } else {
          features['sla_margin'] = UNCERTAINTY_DEFAULT;
          features['sla_warning_triggered'] = false;
          features['sla_breach_triggered'] = false;
        }
      } else {
        features['sla_margin'] = UNCERTAINTY_DEFAULT;
        features['sla_warning_triggered'] = false;
        features['sla_breach_triggered'] = false;
      }

      const plans = await db.query.recoveryPlans.findMany({
        where: and(
          eq(recoveryPlans.baggageId, baggageId),
          eq(recoveryPlans.orgId, orgId),
        ),
        orderBy: [desc(recoveryPlans.createdAt)],
      });

      features['recovery_plan_exists'] = plans.length > 0;
      features['recovery_plan_count'] = plans.length;
      if (plans.length > 0) {
        features['recovery_plan_status'] = (plans[0]!['status'] as string) ?? 'unknown';
        evidence.push({
          sourceType: 'recovery_plans',
          sourceId: plans[0]!['id'] as string,
          reason: 'Most recent recovery plan',
        });
      } else {
        features['recovery_plan_status'] = 'none';
      }

      const transferFailureSnapshot = await db.query.analyticsSnapshots.findFirst({
        where: and(
          eq(analyticsSnapshots.orgId, orgId),
          eq(analyticsSnapshots.metricName, 'transfer_failure_rate'),
        ),
        orderBy: [desc(analyticsSnapshots.periodFrom)],
      });

      if (transferFailureSnapshot) {
        features['historical_transfer_failure_rate'] = transferFailureSnapshot['value'] ?? 0;
        evidence.push({
          sourceType: 'analytics_snapshots',
          sourceId: transferFailureSnapshot['id'] as string,
          reason: 'Historical transfer failure rate metric',
        });
      } else {
        features['historical_transfer_failure_rate'] = UNCERTAINTY_DEFAULT;
      }
    } catch (err) {
      logger.error({ err, baggageId, orgId }, 'Failed to gather baggage features');
    }

    return {
      subjectType: 'baggage',
      subjectId: baggageId,
      features,
      featureVersion: FEATURE_VERSION,
      generatedAt: new Date(),
      evidence,
    };
  }

  async gatherCaseFeatures(orgId: string, caseId: string): Promise<FeatureSet> {
    const evidence: FeatureSet['evidence'] = [];
    const features: Record<string, number | string | boolean> = {};

    try {
      const caseRecord = await db.query.cases.findFirst({
        where: and(eq(cases.id, caseId), eq(cases.orgId, orgId)),
      });

      if (!caseRecord) {
        features['case_age_minutes'] = UNCERTAINTY_DEFAULT;
        features['case_status'] = 'unknown';
        features['case_priority'] = 'unknown';
        return {
          subjectType: 'case',
          subjectId: caseId,
          features,
          featureVersion: FEATURE_VERSION,
          generatedAt: new Date(),
          evidence,
        };
      }

      const caseAgeMinutes = minutesSince(caseRecord['createdAt'] as Date);
      features['case_age_minutes'] = caseAgeMinutes;
      features['case_status'] = (caseRecord['status'] as string) ?? 'unknown';
      features['case_priority'] = (caseRecord['priority'] as string) ?? 'unknown';
      features['case_type'] = (caseRecord['caseType'] as string) ?? 'unknown';
      features['has_assignment'] = caseRecord['assignedTo'] !== null;
      evidence.push({
        sourceType: 'cases',
        sourceId: caseRecord['id'] as string,
        reason: 'Case base attributes',
      });

      const slaRecord = await db.query.caseSla.findFirst({
        where: and(
          eq(caseSla.caseId, caseId),
          eq(caseSla.orgId, orgId),
          eq(caseSla.status, 'active'),
        ),
      });

      if (slaRecord) {
        const resolutionDue = slaRecord['resolutionDueAt'] as Date | null;
        const createdAt = caseRecord['createdAt'] as Date;

        if (resolutionDue) {
          const totalSlaMinutes = (resolutionDue.getTime() - createdAt.getTime()) / (1000 * 60);
          const elapsedMinutes = (Date.now() - createdAt.getTime()) / (1000 * 60);
          features['sla_percent_elapsed'] = totalSlaMinutes > 0
            ? Math.min(100, Math.round((elapsedMinutes / totalSlaMinutes) * 100))
            : 100;
        } else {
          features['sla_percent_elapsed'] = UNCERTAINTY_DEFAULT;
        }

        features['sla_responded'] = slaRecord['respondedAt'] !== null;
        features['sla_breached'] = slaRecord['breachTriggeredAt'] !== null;
        features['sla_warning'] = slaRecord['warningTriggeredAt'] !== null;
        evidence.push({
          sourceType: 'case_sla',
          sourceId: slaRecord['id'] as string,
          reason: 'SLA progress for case',
        });
      } else {
        features['sla_percent_elapsed'] = UNCERTAINTY_DEFAULT;
        features['sla_responded'] = false;
        features['sla_breached'] = false;
        features['sla_warning'] = false;
      }

      const escalations = await db.query.caseEscalations.findMany({
        where: and(
          eq(caseEscalations.caseId, caseId),
          eq(caseEscalations.orgId, orgId),
        ),
        orderBy: [desc(caseEscalations.createdAt)],
      });

      if (escalations.length > 0) {
        const latest = escalations[0]!;
        const levelMap: Record<string, number> = {
          'level_1': 1,
          'level_2': 2,
          'level_3': 3,
          'critical': 4,
        };
        features['escalation_level'] = levelMap[(latest['escalationLevel'] as string)] ?? 0;
        features['escalation_status'] = (latest['status'] as string) ?? 'unknown';
        features['total_escalations'] = escalations.length;
        evidence.push({
          sourceType: 'case_escalations',
          sourceId: latest['id'] as string,
          reason: `Latest escalation at level: ${latest['escalationLevel']}`,
        });
      } else {
        features['escalation_level'] = 0;
        features['escalation_status'] = 'none';
        features['total_escalations'] = 0;
      }

      const caseTasks = await db.query.tasks.findMany({
        where: and(
          eq(tasks.caseId, caseId),
          eq(tasks.orgId, orgId),
        ),
      });

      features['task_count'] = caseTasks.length;
      features['pending_tasks'] = caseTasks.filter((t) => t['status'] === 'pending').length;
      features['completed_tasks'] = caseTasks.filter((t) => t['status'] === 'completed').length;
      features['blocked_tasks'] = caseTasks.filter((t) => t['status'] === 'blocked').length;
      evidence.push({
        sourceType: 'tasks',
        sourceId: caseId,
        reason: `${caseTasks.length} tasks for case`,
      });
    } catch (err) {
      logger.error({ err, caseId, orgId }, 'Failed to gather case features');
    }

    return {
      subjectType: 'case',
      subjectId: caseId,
      features,
      featureVersion: FEATURE_VERSION,
      generatedAt: new Date(),
      evidence,
    };
  }

  async gatherAirportFeatures(orgId: string, airportCode: string): Promise<FeatureSet> {
    const evidence: FeatureSet['evidence'] = [];
    const features: Record<string, number | string | boolean> = {};

    try {
      const transferFailureSnapshot = await db.query.analyticsSnapshots.findFirst({
        where: and(
          eq(analyticsSnapshots.orgId, orgId),
          eq(analyticsSnapshots.metricName, 'transfer_failure_rate'),
          sql`${analyticsSnapshots.dimensions} ->> 'airportCode' = ${airportCode}`,
        ),
        orderBy: [desc(analyticsSnapshots.periodFrom)],
      });

      if (transferFailureSnapshot) {
        features['transfer_failure_rate'] = transferFailureSnapshot['value'] ?? 0;
        evidence.push({
          sourceType: 'analytics_snapshots',
          sourceId: transferFailureSnapshot['id'] as string,
          reason: 'Transfer failure rate for airport',
        });
      } else {
        features['transfer_failure_rate'] = UNCERTAINTY_DEFAULT;
      }

      const activeCasesAtAirport = await db.query.cases.findMany({
        where: and(
          eq(cases.orgId, orgId),
          sql`${cases.status} NOT IN ('closed', 'cancelled', 'duplicate')`,
          sql`EXISTS (
            SELECT 1 FROM baggage
            WHERE baggage.id = ${cases.baggageId}
            AND baggage.current_location = ${airportCode}
          )`,
        ),
      });

      features['active_cases'] = activeCasesAtAirport.length;
      for (const c of activeCasesAtAirport.slice(0, 3)) {
        evidence.push({
          sourceType: 'cases',
          sourceId: c['id'] as string,
          reason: `Active case at airport ${airportCode}`,
        });
      }

      const activeRecoveriesAtAirport = await db.query.recoveryPlans.findMany({
        where: and(
          eq(recoveryPlans.orgId, orgId),
          sql`(${recoveryPlans.origin} = ${airportCode} OR ${recoveryPlans.destination} = ${airportCode} OR ${recoveryPlans.currentLocation} = ${airportCode})`,
          sql`${recoveryPlans.status} NOT IN ('completed', 'cancelled')`,
        ),
      });

      features['active_recoveries'] = activeRecoveriesAtAirport.length;
      for (const p of activeRecoveriesAtAirport.slice(0, 3)) {
        evidence.push({
          sourceType: 'recovery_plans',
          sourceId: p['id'] as string,
          reason: `Active recovery plan at airport ${airportCode}`,
        });
      }

      const activeProviders = await db.query.recoveryProviders.findMany({
        where: and(
          eq(recoveryProviders.orgId, orgId),
          eq(recoveryProviders.status, 'active'),
        ),
      });

      features['provider_count'] = activeProviders.length;
      evidence.push({
        sourceType: 'recovery_providers',
        sourceId: orgId,
        reason: `${activeProviders.length} active recovery providers`,
      });

      const baggageAtAirport = await db.execute<{ count: string }>(
        sql`SELECT COUNT(*)::text as count FROM baggage WHERE org_id = ${orgId} AND current_location = ${airportCode} AND status = 'active'`,
      );

      features['active_baggage_count'] = parseInt(baggageAtAirport[0]?.['count'] ?? '0', 10);
    } catch (err) {
      logger.error({ err, airportCode, orgId }, 'Failed to gather airport features');
    }

    return {
      subjectType: 'airport',
      subjectId: airportCode,
      features,
      featureVersion: FEATURE_VERSION,
      generatedAt: new Date(),
      evidence,
    };
  }
}

export const aiFeatureService = new AIFeatureService();
