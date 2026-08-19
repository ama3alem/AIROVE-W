import { db, operationalExceptions } from '@airove/db';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from './logger';
import { auditLog } from './audit-logger';
import type { OperationalExceptionType, ExceptionSeverity } from '@airove/shared';

export interface CreateExceptionInput {
  orgId: string;
  baggageId?: string;
  flightId?: string;
  journeyId?: string;
  exceptionType: OperationalExceptionType;
  severity: ExceptionSeverity;
  description: string;
  expectedEventId?: string;
  actualEventId?: string;
  location?: string;
  airportCode?: string;
  metadata?: Record<string, unknown>;
}

let pipelineTriggerFn: ((exceptionId: string, orgId: string) => Promise<void>) | null = null;

export function registerPipelineTrigger(fn: (exceptionId: string, orgId: string) => Promise<void>) {
  pipelineTriggerFn = fn;
}

export class ExceptionService {
  async createException(input: CreateExceptionInput) {
    const result = await db.insert(operationalExceptions).values({
      orgId: input.orgId,
      baggageId: input.baggageId ?? null,
      flightId: input.flightId ?? null,
      journeyId: input.journeyId ?? null,
      exceptionType: input.exceptionType,
      severity: input.severity,
      description: input.description,
      expectedEventId: input.expectedEventId ?? null,
      actualEventId: input.actualEventId ?? null,
      location: input.location ?? null,
      airportCode: input.airportCode ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    }).returning();

    const exception = result[0];
    if (!exception) {
      throw new Error('Failed to create operational exception');
    }

    await auditLog({
      orgId: input.orgId,
      action: 'operational_exception.create',
      entityType: 'operational_exception',
      entityId: exception.id,
      entityRef: input.exceptionType,
    });

    logger.warn(
      { exceptionId: exception.id, type: input.exceptionType, severity: input.severity, baggageId: input.baggageId },
      'Operational exception created',
    );

    if (pipelineTriggerFn) {
      try {
        await pipelineTriggerFn(exception.id, input.orgId);
      } catch (err) {
        logger.error(
          { exceptionId: exception.id, error: err instanceof Error ? err.message : String(err) },
          'Failed to trigger exception pipeline (non-blocking)',
        );
      }
    }

    return exception;
  }

  async resolveException(params: {
    exceptionId: string;
    orgId: string;
    resolvedBy: string;
    resolution: string;
  }) {
    const [updated] = await db
      .update(operationalExceptions)
      .set({
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: params.resolvedBy,
        resolution: params.resolution,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(operationalExceptions.id, params.exceptionId),
          eq(operationalExceptions.orgId, params.orgId),
        ),
      )
      .returning();

    if (!updated) return null;

    await auditLog({
      orgId: params.orgId,
      userId: params.resolvedBy,
      action: 'operational_exception.resolve',
      entityType: 'operational_exception',
      entityId: params.exceptionId,
      entityRef: params.resolution,
    });

    return updated;
  }

  async listByBaggage(baggageId: string, orgId: string) {
    return db.query.operationalExceptions.findMany({
      where: and(
        eq(operationalExceptions.baggageId, baggageId),
        eq(operationalExceptions.orgId, orgId),
      ),
      orderBy: [desc(operationalExceptions.createdAt)],
    });
  }

  async listUnresolved(orgId: string) {
    return db.query.operationalExceptions.findMany({
      where: and(
        eq(operationalExceptions.orgId, orgId),
        eq(operationalExceptions.resolved, false),
      ),
      orderBy: [desc(operationalExceptions.createdAt)],
    });
  }

  async listByType(orgId: string, exceptionType: OperationalExceptionType) {
    return db.query.operationalExceptions.findMany({
      where: and(
        eq(operationalExceptions.orgId, orgId),
        eq(operationalExceptions.exceptionType, exceptionType),
      ),
      orderBy: [desc(operationalExceptions.createdAt)],
    });
  }

  async getById(exceptionId: string, orgId: string) {
    return db.query.operationalExceptions.findFirst({
      where: and(
        eq(operationalExceptions.id, exceptionId),
        eq(operationalExceptions.orgId, orgId),
      ),
    });
  }

  async generateTransferMissingException(params: {
    orgId: string;
    baggageId: string;
    expectedEventId: string;
    location?: string;
    airportCode?: string;
  }) {
    return this.createException({
      orgId: params.orgId,
      baggageId: params.baggageId,
      exceptionType: 'expected_event_missing',
      severity: 'warning',
      description: 'Expected transfer event has not been received within the operational window',
      expectedEventId: params.expectedEventId,
      location: params.location,
      airportCode: params.airportCode,
    });
  }

  async generateUnexpectedEventException(params: {
    orgId: string;
    baggageId: string;
    actualEventId: string;
    eventType: string;
    description: string;
    location?: string;
    airportCode?: string;
  }) {
    return this.createException({
      orgId: params.orgId,
      baggageId: params.baggageId,
      exceptionType: 'unexpected_event',
      severity: 'info',
      description: params.description,
      actualEventId: params.actualEventId,
      location: params.location,
      airportCode: params.airportCode,
      metadata: { unexpectedEventType: params.eventType },
    });
  }

  async generateInvalidTransitionException(params: {
    orgId: string;
    baggageId: string;
    actualEventId: string;
    currentState: string;
    eventType: string;
  }) {
    return this.createException({
      orgId: params.orgId,
      baggageId: params.baggageId,
      exceptionType: 'invalid_transition',
      severity: 'warning',
      description: `Invalid state transition: attempted '${params.eventType}' while in state '${params.currentState}'`,
      actualEventId: params.actualEventId,
    });
  }

  async linkToCase(exceptionId: string, caseId: string, orgId: string) {
    const [updated] = await db
      .update(operationalExceptions)
      .set({ caseId, updatedAt: new Date() })
      .where(
        and(
          eq(operationalExceptions.id, exceptionId),
          eq(operationalExceptions.orgId, orgId),
        ),
      )
      .returning();

    return updated ?? null;
  }
}

export const exceptionService = new ExceptionService();
