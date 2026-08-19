import { db, baggage, baggageEvents, cases, tasks, caseSla, recoveryPlans } from '@airove/db';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from './logger.js';

export interface EvidenceItem {
  sourceLayer: string;
  sourceType: string;
  sourceId: string;
  evidenceType: 'FACT' | 'INFERENCE' | 'RECOMMENDATION';
  description: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: Date | null;
}

export class AIEvidenceService {
  async gatherBaggageEvidence(orgId: string, baggageId: string): Promise<EvidenceItem[]> {
    const evidence: EvidenceItem[] = [];

    const [bag] = await db
      .select()
      .from(baggage)
      .where(and(eq(baggage['id'], baggageId), eq(baggage['orgId'], orgId)))
      .limit(1);

    if (bag) {
      evidence.push({
        sourceLayer: 'L3',
        sourceType: 'Baggage',
        sourceId: bag['id'],
        evidenceType: 'FACT',
        description: `Baggage ${bag['tagNumber']} exists in system with status: ${bag['status']}`,
        confidence: 'HIGH',
        timestamp: bag['createdAt'],
      });
    }

    const events = await db
      .select()
      .from(baggageEvents)
      .where(and(eq(baggageEvents['baggageId'], baggageId), eq(baggageEvents['orgId'], orgId)))
      .orderBy(desc(baggageEvents['occurredAt']))
      .limit(5);

    for (const event of events) {
      evidence.push({
        sourceLayer: 'L4',
        sourceType: 'BaggageEvent',
        sourceId: event['id'],
        evidenceType: 'FACT',
        description: `Event: ${event['eventType']} at ${event['location'] ?? 'unknown'} on ${event['occurredAt'].toISOString()}`,
        confidence: 'HIGH',
        timestamp: event['occurredAt'],
      });
    }

    return evidence;
  }

  async gatherCaseEvidence(orgId: string, caseId: string): Promise<EvidenceItem[]> {
    const evidence: EvidenceItem[] = [];

    const [caseRecord] = await db
      .select()
      .from(cases)
      .where(and(eq(cases['id'], caseId), eq(cases['orgId'], orgId)))
      .limit(1);

    if (caseRecord) {
      evidence.push({
        sourceLayer: 'L5',
        sourceType: 'Case',
        sourceId: caseRecord['id'],
        evidenceType: 'FACT',
        description: `Case ${caseRecord['caseNumber']} with status: ${caseRecord['status']}, priority: ${caseRecord['priority']}`,
        confidence: 'HIGH',
        timestamp: caseRecord['createdAt'],
      });

      const caseTasks = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks['caseId'], caseId), eq(tasks['orgId'], orgId)))
        .limit(10);

      for (const task of caseTasks) {
        evidence.push({
          sourceLayer: 'L5',
          sourceType: 'Task',
          sourceId: task['id'],
          evidenceType: 'FACT',
          description: `Task: ${task['title']} with status: ${task['status']}`,
          confidence: 'HIGH',
          timestamp: task['createdAt'],
        });
      }

      const [sla] = await db
        .select()
        .from(caseSla)
        .where(and(eq(caseSla['caseId'], caseId), eq(caseSla['orgId'], orgId)))
        .limit(1);

      if (sla) {
        evidence.push({
          sourceLayer: 'L5',
          sourceType: 'CaseSLA',
          sourceId: sla['id'],
          evidenceType: 'FACT',
          description: `SLA status: ${sla['status']}, response due: ${sla['responseDueAt'].toISOString()}, resolution due: ${sla['resolutionDueAt'].toISOString()}`,
          confidence: 'HIGH',
          timestamp: sla['createdAt'],
        });
      }
    }

    return evidence;
  }

  async gatherRecoveryEvidence(orgId: string, planId: string): Promise<EvidenceItem[]> {
    const evidence: EvidenceItem[] = [];

    const [plan] = await db
      .select()
      .from(recoveryPlans)
      .where(and(eq(recoveryPlans['id'], planId), eq(recoveryPlans['orgId'], orgId)))
      .limit(1);

    if (plan) {
      evidence.push({
        sourceLayer: 'L6',
        sourceType: 'RecoveryPlan',
        sourceId: plan['id'],
        evidenceType: 'FACT',
        description: `Recovery plan ${plan['planNumber']} with status: ${plan['status']}, type: ${plan['recoveryType']}`,
        confidence: 'HIGH',
        timestamp: plan['createdAt'],
      });
    }

    return evidence;
  }

  async gatherEvidence(orgId: string, subjectType: string, subjectId: string): Promise<EvidenceItem[]> {
    switch (subjectType) {
      case 'baggage':
        return this.gatherBaggageEvidence(orgId, subjectId);
      case 'case':
        return this.gatherCaseEvidence(orgId, subjectId);
      case 'recovery_plan':
        return this.gatherRecoveryEvidence(orgId, subjectId);
      default:
        logger.warn({ subjectType, subjectId }, 'Unknown subject type for evidence gathering');
        return [];
    }
  }
}

export const aiEvidenceService = new AIEvidenceService();
