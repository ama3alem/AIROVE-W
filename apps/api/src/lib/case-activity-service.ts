import { db, caseActivities, caseComments } from '@airove/db';
import { eq, and, sql, desc, asc } from 'drizzle-orm';
import pino from 'pino';
import { auditLog } from './audit-logger.js';

const logger = pino({ name: 'layer5-case-activity' });

export interface LogActivityInput {
  caseId: string;
  orgId: string;
  activityType: string;
  actorId?: string;
  description?: string;
  previousValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
}

export class CaseActivityService {
  async logActivity(
    caseId: string,
    orgId: string,
    activityType: string,
    actorId: string | undefined,
    description: string,
    previousValue?: string,
    newValue?: string,
    metadata?: Record<string, unknown>,
  ) {
    const result = await db
      .insert(caseActivities)
      .values({
        caseId,
        orgId,
        activityType,
        actorId: actorId ?? null,
        description,
        previousValue: previousValue ?? null,
        newValue: newValue ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      })
      .returning();

    const activity = result[0];
    if (!activity) {
      throw new Error('Failed to log activity');
    }

    logger.debug({ caseId, activityType, actorId }, 'Activity logged');
    return activity;
  }

  async getTimeline(caseId: string, orgId: string) {
    return db.query.caseActivities.findMany({
      where: and(
        eq(caseActivities.caseId, caseId),
        eq(caseActivities.orgId, orgId),
      ),
      orderBy: [asc(caseActivities.createdAt)],
    });
  }

  async addComment(
    caseId: string,
    orgId: string,
    authorId: string,
    authorOrgId: string | undefined,
    content: string,
  ) {
    const result = await db
      .insert(caseComments)
      .values({
        caseId,
        orgId,
        authorId,
        authorOrganizationId: authorOrgId ?? null,
        content,
      })
      .returning();

    const comment = result[0];
    if (!comment) {
      throw new Error('Failed to add comment');
    }

    await this.logActivity(
      caseId,
      orgId,
      'comment_added',
      authorId,
      `Comment added by ${authorId}`,
    );

    logger.debug({ caseId, authorId }, 'Comment added');
    return comment;
  }

  async getComments(caseId: string, orgId: string, page?: number, pageSize?: number) {
    const p = page ?? 1;
    const ps = Math.min(pageSize ?? 25, 100);
    const offset = (p - 1) * ps;

    const conditions = [
      eq(caseComments.caseId, caseId),
      eq(caseComments.orgId, orgId),
    ];

    const [items, countResult] = await Promise.all([
      db.query.caseComments.findMany({
        where: and(...conditions),
        orderBy: [desc(caseComments.createdAt)],
        limit: ps,
        offset,
      }),
      db.execute<{ count: string }>(
        sql`SELECT COUNT(*)::text as count FROM case_comments WHERE case_id = ${caseId} AND org_id = ${orgId}`,
      ),
    ]);

    const total = parseInt(countResult[0]?.count ?? '0', 10);

    return {
      items,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  async getCommentCount(caseId: string, orgId: string) {
    const result = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text as count FROM case_comments WHERE case_id = ${caseId} AND org_id = ${orgId}`,
    );
    return parseInt(result[0]?.count ?? '0', 10);
  }

  async logCaseCreated(caseId: string, orgId: string, actorId: string) {
    return this.logActivity(caseId, orgId, 'case_created', actorId, 'Case created');
  }

  async logCaseAssigned(
    caseId: string,
    orgId: string,
    actorId: string,
    assignedTo: string,
    previousAssignee?: string,
  ) {
    const type = previousAssignee ? 'case_reassigned' : 'case_assigned';
    const desc = previousAssignee
      ? `Case reassigned from ${previousAssignee} to ${assignedTo}`
      : `Case assigned to ${assignedTo}`;
    return this.logActivity(
      caseId,
      orgId,
      type,
      actorId,
      desc,
      previousAssignee,
      assignedTo,
    );
  }

  async logCaseStatusChanged(
    caseId: string,
    orgId: string,
    actorId: string,
    fromStatus: string,
    toStatus: string,
  ) {
    return this.logActivity(
      caseId,
      orgId,
      'case_status_changed',
      actorId,
      `Status changed from '${fromStatus}' to '${toStatus}'`,
      fromStatus,
      toStatus,
    );
  }

  async logCasePriorityChanged(
    caseId: string,
    orgId: string,
    actorId: string,
    fromPriority: string,
    toPriority: string,
  ) {
    return this.logActivity(
      caseId,
      orgId,
      'case_priority_changed',
      actorId,
      `Priority changed from '${fromPriority}' to '${toPriority}'`,
      fromPriority,
      toPriority,
    );
  }

  async logCaseResolved(
    caseId: string,
    orgId: string,
    actorId: string,
    resolution: string,
    resolutionCode: string,
  ) {
    return this.logActivity(
      caseId,
      orgId,
      'case_resolved',
      actorId,
      `Case resolved: ${resolutionCode}`,
      undefined,
      resolution,
      { resolutionCode },
    );
  }

  async logCaseEscalated(caseId: string, orgId: string, actorId: string) {
    return this.logActivity(
      caseId,
      orgId,
      'case_escalated',
      actorId,
      'Case escalated',
    );
  }

  async logCaseReopened(caseId: string, orgId: string, actorId: string) {
    return this.logActivity(
      caseId,
      orgId,
      'case_reopened',
      actorId,
      'Case reopened',
    );
  }

  async logCaseClosed(caseId: string, orgId: string, actorId: string) {
    return this.logActivity(
      caseId,
      orgId,
      'case_closed',
      actorId,
      'Case closed',
    );
  }

  async logTaskCreated(taskId: string, caseId: string, orgId: string, actorId: string) {
    return this.logActivity(
      caseId,
      orgId,
      'task_created',
      actorId,
      `Task ${taskId} created`,
      undefined,
      taskId,
      { taskId },
    );
  }

  async logTaskAssigned(
    taskId: string,
    caseId: string,
    orgId: string,
    actorId: string,
    assignedTo: string,
  ) {
    return this.logActivity(
      caseId,
      orgId,
      'task_assigned',
      actorId,
      `Task ${taskId} assigned to ${assignedTo}`,
      undefined,
      assignedTo,
      { taskId },
    );
  }

  async logTaskCompleted(taskId: string, caseId: string, orgId: string, actorId: string) {
    return this.logActivity(
      caseId,
      orgId,
      'task_completed',
      actorId,
      `Task ${taskId} completed`,
      undefined,
      undefined,
      { taskId },
    );
  }

  async logSLAStarted(caseId: string, orgId: string, actorId: string) {
    return this.logActivity(
      caseId,
      orgId,
      'sla_started',
      actorId,
      'SLA tracking started',
    );
  }

  async logSLAPaused(caseId: string, orgId: string, actorId: string, reason: string) {
    return this.logActivity(
      caseId,
      orgId,
      'sla_paused',
      actorId,
      `SLA paused: ${reason}`,
      undefined,
      undefined,
      { reason },
    );
  }

  async logSLAResumed(caseId: string, orgId: string, actorId: string) {
    return this.logActivity(
      caseId,
      orgId,
      'sla_resumed',
      actorId,
      'SLA resumed',
    );
  }

  async logSLAWarning(caseId: string, orgId: string) {
    return this.logActivity(
      caseId,
      orgId,
      'sla_warning',
      undefined,
      'SLA warning threshold reached',
    );
  }

  async logSLABreached(caseId: string, orgId: string) {
    return this.logActivity(
      caseId,
      orgId,
      'sla_breached',
      undefined,
      'SLA breached',
    );
  }
}

export const caseActivityService = new CaseActivityService();
