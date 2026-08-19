import { db, cases } from '@airove/db';
import { eq, and, sql, asc, desc } from 'drizzle-orm';
import pino from 'pino';
import { auditLog } from './audit-logger.js';
import { validateCaseTransition, isValidCaseTransition, isReopenableStatus } from './case-state-machine.js';

const logger = pino({ name: 'layer5-case-service' });

export interface CreateCaseInput {
  caseType: string;
  baggageId?: string;
  flightId?: string;
  journeyId?: string;
  title?: string;
  priority?: string;
  source?: string;
  description?: string;
  assignedTo?: string;
  assignedOrganizationId?: string;
  originOrganizationId?: string;
  sourceExceptionId?: string;
  workflowId?: string;
  metadata?: Record<string, unknown>;
}

export interface ListCaseFilters {
  status?: string;
  priority?: string;
  caseType?: string;
  assignedTo?: string;
  page?: number;
  pageSize?: number;
}

export interface UpdateCaseInput {
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  caseType?: string;
  metadata?: Record<string, unknown>;
}

export class CaseService {
  async createCase(input: CreateCaseInput, orgId: string, userId: string) {
    const countResult = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text as count FROM cases WHERE org_id = ${orgId}`,
    );
    const count = parseInt(countResult[0]?.count ?? '0', 10);
    const caseNumber = `CASE-${String(count + 1).padStart(6, '0')}`;

    const result = await db
      .insert(cases)
      .values({
        orgId,
        caseNumber,
        caseType: input.caseType,
        baggageId: input.baggageId ?? null,
        flightId: input.flightId ?? null,
        journeyId: input.journeyId ?? null,
        title: input.title ?? null,
        priority: input.priority ?? 'medium',
        status: 'open',
        assignedTo: input.assignedTo ?? null,
        assignedOrganizationId: input.assignedOrganizationId ?? null,
        originOrganizationId: input.originOrganizationId ?? orgId,
        sourceExceptionId: input.sourceExceptionId ?? null,
        source: input.source ?? 'operator',
        description: input.description ?? null,
        workflowId: input.workflowId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      })
      .returning();

    const createdCase = result[0];
    if (!createdCase) {
      throw new Error('Failed to create case');
    }

    await auditLog({
      orgId,
      userId,
      action: 'case.create',
      entityType: 'case',
      entityId: createdCase.id,
      entityRef: caseNumber,
    });

    logger.info({ caseId: createdCase.id, caseNumber, caseType: input.caseType }, 'Case created');
    return createdCase;
  }

  async getCase(caseId: string, orgId: string) {
    return db.query.cases.findFirst({
      where: and(eq(cases.id, caseId), eq(cases.orgId, orgId)),
    });
  }

  async listCases(orgId: string, filters: ListCaseFilters) {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 25, 100);
    const offset = (page - 1) * pageSize;

    const conditions = [eq(cases.orgId, orgId)];
    if (filters.status) conditions.push(eq(cases.status, filters.status));
    if (filters.priority) conditions.push(eq(cases.priority, filters.priority));
    if (filters.caseType) conditions.push(eq(cases.caseType, filters.caseType));
    if (filters.assignedTo) conditions.push(eq(cases.assignedTo, filters.assignedTo));

    const where = and(...conditions);

    const [items, countResult] = await Promise.all([
      db.query.cases.findMany({
        where,
        orderBy: [desc(cases.createdAt)],
        limit: pageSize,
        offset,
      }),
      db.execute<{ count: string }>(
        sql`SELECT COUNT(*)::text as count FROM cases WHERE ${where}`,
      ),
    ]);

    const total = parseInt(countResult[0]?.count ?? '0', 10);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateCase(caseId: string, orgId: string, updates: UpdateCaseInput) {
    const existing = await this.getCase(caseId, orgId);
    if (!existing) {
      throw new Error('Case not found');
    }

    if (updates.status && updates.status !== existing.status) {
      const validation = validateCaseTransition(existing.status, updates.status);
      if (!validation.allowed) {
        throw new Error(validation.reason);
      }
    }

    const setValues: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.title !== undefined) setValues['title'] = updates.title;
    if (updates.description !== undefined) setValues['description'] = updates.description;
    if (updates.priority !== undefined) setValues['priority'] = updates.priority;
    if (updates.status !== undefined) setValues['status'] = updates.status;
    if (updates.caseType !== undefined) setValues['caseType'] = updates.caseType;
    if (updates.metadata !== undefined) {
      setValues['metadata'] = JSON.stringify(updates.metadata);
    }

    const [updated] = await db
      .update(cases)
      .set(setValues)
      .where(and(eq(cases.id, caseId), eq(cases.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to update case');
    }

    await auditLog({
      orgId,
      action: 'case.update',
      entityType: 'case',
      entityId: caseId,
      entityRef: existing.caseNumber,
      changes: JSON.stringify(updates),
    });

    logger.info({ caseId, changes: Object.keys(updates) }, 'Case updated');
    return updated;
  }

  async assignCase(
    caseId: string,
    orgId: string,
    assignedTo: string,
    assignedOrgId?: string,
  ) {
    const existing = await this.getCase(caseId, orgId);
    if (!existing) {
      throw new Error('Case not found');
    }

    if (existing.status === 'open' || existing.status === 'triaged') {
      const validation = validateCaseTransition(existing.status, 'assigned');
      if (!validation.allowed) {
        throw new Error(validation.reason);
      }
    }

    const [updated] = await db
      .update(cases)
      .set({
        assignedTo,
        assignedOrganizationId: assignedOrgId ?? null,
        status: 'assigned',
        updatedAt: new Date(),
      })
      .where(and(eq(cases.id, caseId), eq(cases.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to assign case');
    }

    await auditLog({
      orgId,
      action: 'case.assign',
      entityType: 'case',
      entityId: caseId,
      entityRef: existing.caseNumber,
      changes: JSON.stringify({ assignedTo, assignedOrgId }),
    });

    logger.info({ caseId, assignedTo }, 'Case assigned');
    return updated;
  }

  async reassignCase(
    caseId: string,
    orgId: string,
    newAssignee: string,
    newOrgId?: string,
  ) {
    const existing = await this.getCase(caseId, orgId);
    if (!existing) {
      throw new Error('Case not found');
    }

    if (existing.status === 'closed' || existing.status === 'cancelled' || existing.status === 'duplicate') {
      throw new Error(`Cannot reassign case in terminal status '${existing.status}'`);
    }

    const previousAssignee = existing.assignedTo;

    const [updated] = await db
      .update(cases)
      .set({
        assignedTo: newAssignee,
        assignedOrganizationId: newOrgId ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(cases.id, caseId), eq(cases.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to reassign case');
    }

    await auditLog({
      orgId,
      action: 'case.reassign',
      entityType: 'case',
      entityId: caseId,
      entityRef: existing.caseNumber,
      changes: JSON.stringify({ from: previousAssignee, to: newAssignee }),
    });

    logger.info({ caseId, previousAssignee, newAssignee }, 'Case reassigned');
    return updated;
  }

  async escalateCase(caseId: string, orgId: string) {
    const existing = await this.getCase(caseId, orgId);
    if (!existing) {
      throw new Error('Case not found');
    }

    if (existing.status === 'closed' || existing.status === 'cancelled' || existing.status === 'duplicate') {
      throw new Error(`Cannot escalate case in terminal status '${existing.status}'`);
    }

    const [updated] = await db
      .update(cases)
      .set({
        escalatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(cases.id, caseId), eq(cases.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to escalate case');
    }

    await auditLog({
      orgId,
      action: 'case.escalate',
      entityType: 'case',
      entityId: caseId,
      entityRef: existing.caseNumber,
    });

    logger.info({ caseId }, 'Case escalated');
    return updated;
  }

  async resolveCase(
    caseId: string,
    orgId: string,
    resolution: string,
    resolutionCode: string,
    userId: string,
  ) {
    const existing = await this.getCase(caseId, orgId);
    if (!existing) {
      throw new Error('Case not found');
    }

    const validation = validateCaseTransition(existing.status, 'resolved');
    if (!validation.allowed) {
      throw new Error(validation.reason);
    }

    const [updated] = await db
      .update(cases)
      .set({
        status: 'resolved',
        resolution,
        resolutionCode,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(cases.id, caseId), eq(cases.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to resolve case');
    }

    await auditLog({
      orgId,
      userId,
      action: 'case.resolve',
      entityType: 'case',
      entityId: caseId,
      entityRef: existing.caseNumber,
      changes: JSON.stringify({ resolution, resolutionCode }),
    });

    logger.info({ caseId, resolutionCode }, 'Case resolved');
    return updated;
  }

  async closeCase(caseId: string, orgId: string, userId: string) {
    const existing = await this.getCase(caseId, orgId);
    if (!existing) {
      throw new Error('Case not found');
    }

    const validation = validateCaseTransition(existing.status, 'closed');
    if (!validation.allowed) {
      throw new Error(validation.reason);
    }

    const [updated] = await db
      .update(cases)
      .set({
        status: 'closed',
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(cases.id, caseId), eq(cases.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to close case');
    }

    await auditLog({
      orgId,
      userId,
      action: 'case.close',
      entityType: 'case',
      entityId: caseId,
      entityRef: existing.caseNumber,
    });

    logger.info({ caseId }, 'Case closed');
    return updated;
  }

  async reopenCase(caseId: string, orgId: string, userId: string) {
    const existing = await this.getCase(caseId, orgId);
    if (!existing) {
      throw new Error('Case not found');
    }

    if (!isReopenableStatus(existing.status)) {
      throw new Error(
        `Cannot reopen case in status '${existing.status}'. Only resolved cases can be reopened.`,
      );
    }

    const validation = validateCaseTransition(existing.status, 'triaged');
    if (!validation.allowed) {
      throw new Error(validation.reason);
    }

    const [updated] = await db
      .update(cases)
      .set({
        status: 'triaged',
        resolvedAt: null,
        closedAt: null,
        resolution: null,
        resolutionCode: null,
        updatedAt: new Date(),
      })
      .where(and(eq(cases.id, caseId), eq(cases.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new Error('Failed to reopen case');
    }

    await auditLog({
      orgId,
      userId,
      action: 'case.reopen',
      entityType: 'case',
      entityId: caseId,
      entityRef: existing.caseNumber,
    });

    logger.info({ caseId }, 'Case reopened');
    return updated;
  }

  async getCaseByNumber(caseNumber: string, orgId: string) {
    return db.query.cases.findFirst({
      where: and(eq(cases.caseNumber, caseNumber), eq(cases.orgId, orgId)),
    });
  }

  async findOpenCaseByException(exceptionId: string, orgId: string) {
    return db.query.cases.findFirst({
      where: and(
        eq(cases.sourceExceptionId, exceptionId),
        eq(cases.orgId, orgId),
        sql`${cases.status} NOT IN ('closed', 'cancelled', 'duplicate')`,
      ),
    });
  }

  async findOpenCaseByBaggage(
    baggageId: string,
    orgId: string,
    caseType?: string,
  ) {
    const conditions = [
      eq(cases.baggageId, baggageId),
      eq(cases.orgId, orgId),
      sql`${cases.status} NOT IN ('closed', 'cancelled', 'duplicate')`,
    ];
    if (caseType) {
      conditions.push(eq(cases.caseType, caseType));
    }

    return db.query.cases.findFirst({
      where: and(...conditions),
      orderBy: [desc(cases.createdAt)],
    });
  }
}

export const caseService = new CaseService();
