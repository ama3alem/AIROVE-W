import { db, caseEscalations, caseSla } from '@airove/db';
import { eq, and, sql, desc } from 'drizzle-orm';
import pino from 'pino';
import { auditLog } from './audit-logger.js';

const logger = pino({ name: 'layer5-escalation-engine' });

export const ESCALATION_LEVELS = [
  'level_1',
  'level_2',
  'level_3',
  'critical',
  'executive',
] as const;

export type EscalationLevel = (typeof ESCALATION_LEVELS)[number];

export interface CreateEscalationInput {
  caseId: string;
  escalationLevel: string;
  slaCaseId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export class EscalationService {
  async createEscalation(input: CreateEscalationInput, orgId: string) {
    const result = await db
      .insert(caseEscalations)
      .values({
        caseId: input.caseId,
        orgId,
        escalationLevel: input.escalationLevel,
        status: 'pending',
        slaCaseId: input.slaCaseId ?? null,
        reason: input.reason ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      })
      .returning();

    const escalation = result[0];
    if (!escalation) {
      throw new Error('Failed to create escalation');
    }

    await auditLog({
      orgId,
      action: 'escalation.create',
      entityType: 'case_escalation',
      entityId: escalation.id,
      entityRef: `case:${input.caseId}`,
    });

    logger.info(
      { escalationId: escalation.id, caseId: input.caseId, level: input.escalationLevel },
      'Escalation created',
    );
    return escalation;
  }

  async getEscalation(escalationId: string, orgId: string) {
    return db.query.caseEscalations.findFirst({
      where: and(
        eq(caseEscalations.id, escalationId),
        eq(caseEscalations.orgId, orgId),
      ),
    });
  }

  async listEscalationsByCase(caseId: string, orgId: string) {
    return db.query.caseEscalations.findMany({
      where: and(
        eq(caseEscalations.caseId, caseId),
        eq(caseEscalations.orgId, orgId),
      ),
      orderBy: [desc(caseEscalations.createdAt)],
    });
  }

  async acknowledgeEscalation(
    escalationId: string,
    orgId: string,
    userId: string,
  ) {
    const existing = await this.getEscalation(escalationId, orgId);
    if (!existing) {
      throw new Error('Escalation not found');
    }
    if (existing.acknowledgedAt) {
      throw new Error('Escalation already acknowledged');
    }

    const [updated] = await db
      .update(caseEscalations)
      .set({
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(caseEscalations.id, escalationId),
          eq(caseEscalations.orgId, orgId),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error('Failed to acknowledge escalation');
    }

    await auditLog({
      orgId,
      userId,
      action: 'escalation.acknowledge',
      entityType: 'case_escalation',
      entityId: escalationId,
      entityRef: `case:${existing.caseId}`,
    });

    logger.info({ escalationId, userId }, 'Escalation acknowledged');
    return updated;
  }

  async resolveEscalation(
    escalationId: string,
    orgId: string,
    userId: string,
  ) {
    const existing = await this.getEscalation(escalationId, orgId);
    if (!existing) {
      throw new Error('Escalation not found');
    }
    if (existing.resolvedAt) {
      throw new Error('Escalation already resolved');
    }

    const [updated] = await db
      .update(caseEscalations)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(caseEscalations.id, escalationId),
          eq(caseEscalations.orgId, orgId),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error('Failed to resolve escalation');
    }

    await auditLog({
      orgId,
      userId,
      action: 'escalation.resolve',
      entityType: 'case_escalation',
      entityId: escalationId,
      entityRef: `case:${existing.caseId}`,
    });

    logger.info({ escalationId, userId }, 'Escalation resolved');
    return updated;
  }

  async escalateForSLA(slaId: string, caseId: string, orgId: string) {
    const sla = await db.query.caseSla.findFirst({
      where: and(eq(caseSla.id, slaId), eq(caseSla.orgId, orgId)),
    });

    if (!sla) {
      throw new Error('SLA record not found');
    }

    const now = Date.now();
    const pausedMs = sla.pausedAt
      ? now - new Date(sla.pausedAt).getTime()
      : 0;
    const effectivePausedMs = sla.totalPausedMs + pausedMs;
    const resolutionDueMs = new Date(sla.resolutionDueAt).getTime();
    const totalMs = resolutionDueMs - new Date(sla.createdAt).getTime() + effectivePausedMs;
    const overdueMs = now - (resolutionDueMs + effectivePausedMs);
    const percentOverdue = totalMs > 0 ? (overdueMs / totalMs) * 100 : 100;

    let level: EscalationLevel = 'level_1';
    if (percentOverdue > 200) {
      level = 'executive';
    } else if (percentOverdue > 150) {
      level = 'critical';
    } else if (percentOverdue > 100) {
      level = 'level_3';
    } else if (percentOverdue > 50) {
      level = 'level_2';
    }

    return this.createEscalation(
      {
        caseId,
        escalationLevel: level,
        slaCaseId: slaId,
        reason: `SLA breached. ${Math.round(percentOverdue)}% overdue. ${Math.round(overdueMs / 60_000)} minutes past deadline.`,
      },
      orgId,
    );
  }

  getNextEscalationLevel(currentLevel: string): string | null {
    const idx = ESCALATION_LEVELS.indexOf(currentLevel as EscalationLevel);
    if (idx === -1 || idx >= ESCALATION_LEVELS.length - 1) {
      return null;
    }
    return ESCALATION_LEVELS[idx + 1] ?? null;
  }

  async getActiveEscalations(orgId: string) {
    return db.query.caseEscalations.findMany({
      where: and(
        eq(caseEscalations.orgId, orgId),
        sql`${caseEscalations.resolvedAt} IS NULL`,
      ),
      orderBy: [desc(caseEscalations.createdAt)],
    });
  }

  async autoEscalate(orgId: string) {
    const now = new Date();
    const breachedSLAs = await db.query.caseSla.findMany({
      where: and(
        eq(caseSla.orgId, orgId),
        eq(caseSla.status, 'active'),
        sql`${caseSla.resolutionDueAt} + (${caseSla.totalPausedMs} || ' milliseconds')::interval < ${now}`,
      ),
    });

    const escalated: Array<{ caseId: string; escalationId: string }> = [];

    for (const sla of breachedSLAs) {
      const activeEscalation = await db.query.caseEscalations.findFirst({
        where: and(
          eq(caseEscalations.caseId, sla.caseId),
          eq(caseEscalations.orgId, orgId),
          sql`${caseEscalations.resolvedAt} IS NULL`,
        ),
      });

      if (!activeEscalation) {
        try {
          const escalation = await this.escalateForSLA(sla.id, sla.caseId, orgId);
          escalated.push({ caseId: sla.caseId, escalationId: escalation.id });
          logger.warn(
            { caseId: sla.caseId, slaId: sla.id, level: escalation.escalationLevel },
            'Auto-escalated breached case',
          );
        } catch (err) {
          logger.error({ caseId: sla.caseId, slaId: sla.id }, 'Failed to auto-escalate');
        }
      }
    }

    logger.info({ count: escalated.length }, 'Auto-escalation cycle complete');
    return escalated;
  }
}

export const escalationService = new EscalationService();
