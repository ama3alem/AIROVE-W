import { db, slaPolicies, caseSla, cases } from '@airove/db';
import { eq, and, sql, desc } from 'drizzle-orm';
import pino from 'pino';
import { auditLog } from './audit-logger.js';

const logger = pino({ name: 'layer5-sla-engine' });

export interface CreateSLAPolicyInput {
  name: string;
  description?: string;
  caseType: string;
  priority: string;
  responseMinutes: number;
  resolutionMinutes: number;
  warningThresholdPercent?: number;
  escalationThresholdPercent?: number;
  pauseOnPendingExternal?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateSLAPolicyInput {
  name?: string;
  description?: string;
  caseType?: string;
  priority?: string;
  responseMinutes?: number;
  resolutionMinutes?: number;
  warningThresholdPercent?: number;
  escalationThresholdPercent?: number;
  pauseOnPendingExternal?: boolean;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SLATimeRemaining {
  responseRemainingMs: number;
  resolutionRemainingMs: number;
  isResponseOverdue: boolean;
  isResolutionOverdue: boolean;
}

export class SLAService {
  async createSLAPolicy(input: CreateSLAPolicyInput, orgId: string) {
    const result = await db
      .insert(slaPolicies)
      .values({
        orgId,
        name: input.name,
        description: input.description ?? null,
        caseType: input.caseType,
        priority: input.priority,
        responseMinutes: input.responseMinutes,
        resolutionMinutes: input.resolutionMinutes,
        warningThresholdPercent: input.warningThresholdPercent ?? 75,
        escalationThresholdPercent: input.escalationThresholdPercent ?? 100,
        pauseOnPendingExternal: input.pauseOnPendingExternal ?? true,
        enabled: true,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      })
      .returning();

    const policy = result[0];
    if (!policy) {
      throw new Error('Failed to create SLA policy');
    }

    await auditLog({
      orgId,
      action: 'sla_policy.create',
      entityType: 'sla_policy',
      entityId: policy.id,
      entityRef: input.name,
    });

    logger.info({ policyId: policy.id, name: input.name }, 'SLA policy created');
    return policy;
  }

  async getSLAPolicy(policyId: string, orgId: string) {
    return db.query.slaPolicies.findFirst({
      where: and(eq(slaPolicies.id, policyId), eq(slaPolicies.orgId, orgId)),
    });
  }

  async listSLAPolicies(orgId: string) {
    return db.query.slaPolicies.findMany({
      where: eq(slaPolicies.orgId, orgId),
      orderBy: [desc(slaPolicies.createdAt)],
    });
  }

  async updateSLAPolicy(policyId: string, orgId: string, updates: UpdateSLAPolicyInput) {
    const existing = await this.getSLAPolicy(policyId, orgId);
    if (!existing) {
      throw new Error('SLA policy not found');
    }

    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.name !== undefined) setValues['name'] = updates.name;
    if (updates.description !== undefined) setValues['description'] = updates.description;
    if (updates.caseType !== undefined) setValues['caseType'] = updates.caseType;
    if (updates.priority !== undefined) setValues['priority'] = updates.priority;
    if (updates.responseMinutes !== undefined) setValues['responseMinutes'] = updates.responseMinutes;
    if (updates.resolutionMinutes !== undefined) setValues['resolutionMinutes'] = updates.resolutionMinutes;
    if (updates.warningThresholdPercent !== undefined) setValues['warningThresholdPercent'] = updates.warningThresholdPercent;
    if (updates.escalationThresholdPercent !== undefined) setValues['escalationThresholdPercent'] = updates.escalationThresholdPercent;
    if (updates.pauseOnPendingExternal !== undefined) setValues['pauseOnPendingExternal'] = updates.pauseOnPendingExternal;
    if (updates.enabled !== undefined) setValues['enabled'] = updates.enabled;
    if (updates.metadata !== undefined) setValues['metadata'] = JSON.stringify(updates.metadata);

    const [updated] = await db
      .update(slaPolicies)
      .set(setValues)
      .where(and(eq(slaPolicies.id, policyId), eq(slaPolicies.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to update SLA policy');
    }

    logger.info({ policyId, changes: Object.keys(updates) }, 'SLA policy updated');
    return updated;
  }

  async deleteSLAPolicy(policyId: string, orgId: string) {
    const existing = await this.getSLAPolicy(policyId, orgId);
    if (!existing) {
      throw new Error('SLA policy not found');
    }

    const [updated] = await db
      .update(slaPolicies)
      .set({ enabled: false, updatedAt: new Date() })
      .where(and(eq(slaPolicies.id, policyId), eq(slaPolicies.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to delete SLA policy');
    }

    await auditLog({
      orgId,
      action: 'sla_policy.delete',
      entityType: 'sla_policy',
      entityId: policyId,
      entityRef: existing.name,
    });

    logger.info({ policyId }, 'SLA policy soft-deleted');
    return updated;
  }

  async findMatchingPolicy(caseType: string, priority: string, orgId: string) {
    return db.query.slaPolicies.findFirst({
      where: and(
        eq(slaPolicies.orgId, orgId),
        eq(slaPolicies.caseType, caseType),
        eq(slaPolicies.priority, priority),
        eq(slaPolicies.enabled, true),
      ),
      orderBy: [desc(slaPolicies.createdAt)],
    });
  }

  async startSLA(caseId: string, orgId: string, policyId: string) {
    const policy = await this.getSLAPolicy(policyId, orgId);
    if (!policy) {
      throw new Error('SLA policy not found');
    }

    const now = new Date();
    const responseDueAt = new Date(now.getTime() + policy.responseMinutes * 60_000);
    const resolutionDueAt = new Date(now.getTime() + policy.resolutionMinutes * 60_000);

    const result = await db
      .insert(caseSla)
      .values({
        caseId,
        orgId,
        slaPolicyId: policyId,
        status: 'active',
        responseDueAt,
        resolutionDueAt,
      })
      .returning();

    const sla = result[0];
    if (!sla) {
      throw new Error('Failed to start SLA');
    }

    await auditLog({
      orgId,
      action: 'sla.start',
      entityType: 'case_sla',
      entityId: sla.id,
      entityRef: `case:${caseId}`,
    });

    logger.info({ slaId: sla.id, caseId, responseDueAt, resolutionDueAt }, 'SLA started');
    return sla;
  }

  async getSLAForCase(caseId: string, orgId: string) {
    return db.query.caseSla.findFirst({
      where: and(eq(caseSla.caseId, caseId), eq(caseSla.orgId, orgId)),
      orderBy: [desc(caseSla.createdAt)],
    });
  }

  async pauseSLA(caseId: string, orgId: string, reason: string) {
    const sla = await this.getSLAForCase(caseId, orgId);
    if (!sla) {
      throw new Error('No SLA found for case');
    }
    if (sla.status !== 'active') {
      throw new Error(`Cannot pause SLA in status '${sla.status}'`);
    }

    const [updated] = await db
      .update(caseSla)
      .set({
        status: 'paused',
        pausedAt: new Date(),
        updatedAt: new Date(),
        metadata: JSON.stringify({ pauseReason: reason }),
      })
      .where(and(eq(caseSla.caseId, caseId), eq(caseSla.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to pause SLA');
    }

    logger.info({ caseId, reason }, 'SLA paused');
    return updated;
  }

  async resumeSLA(caseId: string, orgId: string) {
    const sla = await this.getSLAForCase(caseId, orgId);
    if (!sla) {
      throw new Error('No SLA found for case');
    }
    if (sla.status !== 'paused') {
      throw new Error(`Cannot resume SLA in status '${sla.status}'`);
    }

    const pausedMs = sla.pausedAt
      ? Date.now() - new Date(sla.pausedAt).getTime()
      : 0;

    const [updated] = await db
      .update(caseSla)
      .set({
        status: 'active',
        pausedAt: null,
        resumedAt: new Date(),
        totalPausedMs: sla.totalPausedMs + pausedMs,
        updatedAt: new Date(),
      })
      .where(and(eq(caseSla.caseId, caseId), eq(caseSla.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to resume SLA');
    }

    logger.info({ caseId, pausedMs, totalPausedMs: sla.totalPausedMs + pausedMs }, 'SLA resumed');
    return updated;
  }

  async checkSLABreach(caseId: string, orgId: string) {
    const sla = await this.getSLAForCase(caseId, orgId);
    if (!sla) {
      return null;
    }
    if (sla.status !== 'active') {
      return sla;
    }

    const now = Date.now();
    const pausedMs = sla.pausedAt
      ? now - new Date(sla.pausedAt).getTime()
      : 0;
    const effectivePausedMs = sla.totalPausedMs + pausedMs;
    const resolutionDueMs = new Date(sla.resolutionDueAt).getTime();

    if (now > resolutionDueMs + effectivePausedMs) {
      const [updated] = await db
        .update(caseSla)
        .set({
          status: 'breached',
          breachTriggeredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(caseSla.caseId, caseId), eq(caseSla.orgId, orgId)))
        .returning();

      logger.warn({ caseId, slaId: sla.id }, 'SLA breached');
      return updated ?? sla;
    }

    return sla;
  }

  async checkSLAWarning(caseId: string, orgId: string) {
    const sla = await this.getSLAForCase(caseId, orgId);
    if (!sla || sla.status !== 'active') {
      return sla;
    }
    if (sla.warningTriggeredAt) {
      return sla;
    }

    const policy = await this.getSLAPolicy(sla.slaPolicyId, orgId);
    if (!policy) {
      return sla;
    }

    const now = Date.now();
    const pausedMs = sla.pausedAt
      ? now - new Date(sla.pausedAt).getTime()
      : 0;
    const effectivePausedMs = sla.totalPausedMs + pausedMs;
    const resolutionDueMs = new Date(sla.resolutionDueAt).getTime();
    const totalResolutionMs = policy.resolutionMinutes * 60_000;
    const elapsedMs = now - new Date(sla.createdAt).getTime() - effectivePausedMs;
    const percentElapsed = (elapsedMs / totalResolutionMs) * 100;

    if (percentElapsed >= policy.warningThresholdPercent) {
      const [updated] = await db
        .update(caseSla)
        .set({
          warningTriggeredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(caseSla.caseId, caseId), eq(caseSla.orgId, orgId)))
        .returning();

      logger.info({ caseId, slaId: sla.id, percentElapsed }, 'SLA warning triggered');
      return updated ?? sla;
    }

    return sla;
  }

  async getSLATimeRemaining(caseId: string, orgId: string) {
    const sla = await this.getSLAForCase(caseId, orgId);
    if (!sla) {
      return {
        responseRemainingMs: 0,
        resolutionRemainingMs: 0,
        isResponseOverdue: true,
        isResolutionOverdue: true,
      };
    }

    const now = Date.now();
    const pausedMs = sla.pausedAt
      ? now - new Date(sla.pausedAt).getTime()
      : 0;
    const effectivePausedMs = sla.totalPausedMs + pausedMs;

    const responseDueMs = new Date(sla.responseDueAt).getTime();
    const resolutionDueMs = new Date(sla.resolutionDueAt).getTime();

    const responseRemainingMs = responseDueMs - now + effectivePausedMs;
    const resolutionRemainingMs = resolutionDueMs - now + effectivePausedMs;

    return {
      responseRemainingMs,
      resolutionRemainingMs,
      isResponseOverdue: responseRemainingMs < 0,
      isResolutionOverdue: resolutionRemainingMs < 0,
    };
  }

  async checkAllBreachedSLAs(orgId: string) {
    const now = new Date();
    return db.query.caseSla.findMany({
      where: and(
        eq(caseSla.orgId, orgId),
        eq(caseSla.status, 'active'),
        sql`${caseSla.resolutionDueAt} + (${caseSla.totalPausedMs} || ' milliseconds')::interval < ${now}`,
      ),
    });
  }

  async checkAllWarningSLAs(orgId: string) {
    const now = new Date();
    return db.query.caseSla.findMany({
      where: and(
        eq(caseSla.orgId, orgId),
        eq(caseSla.status, 'active'),
        sql`${caseSla.warningTriggeredAt} IS NULL`,
      ),
    });
  }
}

export const slaService = new SLAService();
