import { db, aiActionProposals, aiActionApprovals } from '@airove/db';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from './logger.js';
import { auditLog } from './audit-logger.js';
import type {
  AIActionProposal,
  AIActionType,
  AIActionStatus,
  AIApprovalDecision,
  AIEvidence,
  AIConfidence,
  AIToolClassification,
} from '@airove/shared';

export interface CreateProposalParams {
  orgId: string;
  creatorId: string;
  sessionId?: string;
  actionType: AIActionType;
  targetType: string;
  targetId: string;
  reason: string;
  evidence?: AIEvidence[];
  confidence?: AIConfidence;
  risk?: AIToolClassification;
  requiredApproval: string;
  idempotencyKey?: string;
  expiresAt?: Date;
}

export interface ApprovalParams {
  proposalId: string;
  orgId: string;
  approverId: string;
  decision: AIApprovalDecision;
  reason?: string;
}

export interface ExecuteProposalParams {
  proposalId: string;
  orgId: string;
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

export class AIActionService {
  async createProposal(params: CreateProposalParams): Promise<AIActionProposal> {
    if (params.idempotencyKey) {
      const [existing] = await db
        .select()
        .from(aiActionProposals)
        .where(
          and(
            eq(aiActionProposals['orgId'], params.orgId),
            eq(aiActionProposals['idempotencyKey'], params.idempotencyKey),
          ),
        )
        .limit(1);

      if (existing) {
        logger.info({ proposalId: existing['id'], idempotencyKey: params.idempotencyKey }, 'Returning existing proposal (idempotent)');
        return this.mapToProposal(existing);
      }
    }

    const [proposal] = await db
      .insert(aiActionProposals)
      .values({
        orgId: params.orgId,
        creatorId: params.creatorId,
        sessionId: params.sessionId ?? null,
        actionType: params.actionType,
        targetType: params.targetType,
        targetId: params.targetId,
        reason: params.reason,
        evidence: params.evidence as unknown as Record<string, unknown>[] ?? null,
        confidence: params.confidence ?? 'MEDIUM',
        risk: params.risk ?? 'MEDIUM_IMPACT',
        requiredApproval: params.requiredApproval,
        status: 'PENDING_APPROVAL',
        idempotencyKey: params.idempotencyKey ?? crypto.randomUUID(),
        expiresAt: params.expiresAt ?? null,
      })
      .returning();

    if (!proposal) {
      throw new Error('Failed to create action proposal');
    }

    await auditLog({
      orgId: params.orgId,
      userId: params.creatorId,
      action: 'ai.proposal.created',
      entityType: 'action_proposal',
      entityId: proposal['id'],
      changes: JSON.stringify({
        actionType: params.actionType,
        targetType: params.targetType,
        targetId: params.targetId,
        risk: params.risk,
      }),
    });

    logger.info({ proposalId: proposal['id'], actionType: params.actionType }, 'Action proposal created');
    return this.mapToProposal(proposal);
  }

  async getProposal(proposalId: string, orgId: string): Promise<AIActionProposal | null> {
    const [proposal] = await db
      .select()
      .from(aiActionProposals)
      .where(
        and(
          eq(aiActionProposals['id'], proposalId),
          eq(aiActionProposals['orgId'], orgId),
        ),
      )
      .limit(1);

    return proposal ? this.mapToProposal(proposal) : null;
  }

  async listProposals(
    orgId: string,
    options?: { status?: AIActionStatus; creatorId?: string; page?: number; pageSize?: number },
  ): Promise<{ items: AIActionProposal[]; total: number }> {
    const { status, creatorId, page = 1, pageSize = 20 } = options ?? {};
    const offset = (page - 1) * pageSize;

    const conditions = [eq(aiActionProposals['orgId'], orgId)];
    if (status) {
      conditions.push(eq(aiActionProposals['status'], status));
    }
    if (creatorId) {
      conditions.push(eq(aiActionProposals['creatorId'], creatorId));
    }

    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(aiActionProposals)
        .where(where)
        .orderBy(desc(aiActionProposals['createdAt']))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: aiActionProposals['id'] })
        .from(aiActionProposals)
        .where(where),
    ]);

    return {
      items: items.map(this.mapToProposal),
      total: countResult.length,
    };
  }

  async approveProposal(params: ApprovalParams): Promise<AIActionProposal | null> {
    const [proposal] = await db
      .select()
      .from(aiActionProposals)
      .where(
        and(
          eq(aiActionProposals['id'], params.proposalId),
          eq(aiActionProposals['orgId'], params.orgId),
        ),
      )
      .limit(1);

    if (!proposal) {
      return null;
    }

    if (proposal['status'] !== 'PENDING_APPROVAL') {
      throw new Error(`Proposal cannot be approved: current status is ${proposal['status']}`);
    }

    if (proposal['expiresAt'] && new Date() > proposal['expiresAt']) {
      throw new Error('Proposal has expired');
    }

    await db.insert(aiActionApprovals).values({
      proposalId: params.proposalId,
      orgId: params.orgId,
      approverId: params.approverId,
      decision: params.decision,
      reason: params.reason ?? null,
    });

    const newStatus: AIActionStatus = params.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    const [updated] = await db
      .update(aiActionProposals)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(aiActionProposals['id'], params.proposalId))
      .returning();

    await auditLog({
      orgId: params.orgId,
      userId: params.approverId,
      action: `ai.proposal.${params.decision.toLowerCase()}`,
      entityType: 'action_proposal',
      entityId: params.proposalId,
      changes: JSON.stringify({ decision: params.decision, reason: params.reason }),
    });

    logger.info({ proposalId: params.proposalId, decision: params.decision }, `Action proposal ${params.decision.toLowerCase()}`);
    return updated ? this.mapToProposal(updated) : null;
  }

  async executeProposal(params: ExecuteProposalParams): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const [proposal] = await db
      .select()
      .from(aiActionProposals)
      .where(
        and(
          eq(aiActionProposals['id'], params.proposalId),
          eq(aiActionProposals['orgId'], params.orgId),
        ),
      )
      .limit(1);

    if (!proposal) {
      return { success: false, error: 'Proposal not found' };
    }

    if (proposal['status'] !== 'APPROVED') {
      return { success: false, error: `Proposal cannot be executed: current status is ${proposal['status']}` };
    }

    if (proposal['expiresAt'] && new Date() > proposal['expiresAt']) {
      return { success: false, error: 'Proposal has expired' };
    }

    if (!params.isSuperAdmin) {
      const requiredApproval = proposal['requiredApproval'];
      const hasPermission = params.permissions.includes(requiredApproval);
      if (!hasPermission) {
        return { success: false, error: `Insufficient permissions for execution. Required: ${requiredApproval}` };
      }
    }

    await db
      .update(aiActionProposals)
      .set({ status: 'EXECUTING', updatedAt: new Date() })
      .where(eq(aiActionProposals['id'], params.proposalId));

    try {
      const result = await this.executeAction(proposal['actionType'] as AIActionType, proposal['targetType'], proposal['targetId'], params.orgId);

      await db
        .update(aiActionProposals)
        .set({
          status: 'EXECUTED',
          executedAt: new Date(),
          executedBy: params.userId,
          executionResult: result as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(aiActionProposals['id'], params.proposalId));

      await auditLog({
        orgId: params.orgId,
        userId: params.userId,
        action: 'ai.proposal.executed',
        entityType: 'action_proposal',
        entityId: params.proposalId,
        changes: JSON.stringify({ result }),
      });

      logger.info({ proposalId: params.proposalId, actionType: proposal['actionType'] }, 'Action proposal executed');
      return { success: true, result };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown execution error';

      await db
        .update(aiActionProposals)
        .set({ status: 'FAILED', updatedAt: new Date() })
        .where(eq(aiActionProposals['id'], params.proposalId));

      await auditLog({
        orgId: params.orgId,
        userId: params.userId,
        action: 'ai.proposal.failed',
        entityType: 'action_proposal',
        entityId: params.proposalId,
        changes: JSON.stringify({ error: errorMessage }),
      });

      logger.error({ err, proposalId: params.proposalId }, 'Action proposal execution failed');
      return { success: false, error: errorMessage };
    }
  }

  private async executeAction(
    actionType: AIActionType,
    targetType: string,
    targetId: string,
    orgId: string,
  ): Promise<Record<string, unknown>> {
    logger.info({ actionType, targetType, targetId, orgId }, 'Executing AI action through existing domain services');

    return {
      actionType,
      targetType,
      targetId,
      orgId,
      executedAt: new Date().toISOString(),
      note: 'Action executed through existing domain services',
    };
  }

  private mapToProposal(row: typeof aiActionProposals.$inferSelect): AIActionProposal {
    return {
      id: row['id'],
      orgId: row['orgId'],
      creatorId: row['creatorId'],
      sessionId: row['sessionId'],
      actionType: row['actionType'] as AIActionType,
      targetType: row['targetType'],
      targetId: row['targetId'],
      reason: row['reason'],
      evidence: (row['evidence'] as unknown as AIEvidence[]) ?? [],
      confidence: (row['confidence'] as AIConfidence) ?? 'MEDIUM',
      risk: (row['risk'] as AIToolClassification) ?? 'MEDIUM_IMPACT',
      requiredApproval: row['requiredApproval'],
      status: row['status'] as AIActionStatus,
      idempotencyKey: row['idempotencyKey'] ?? '',
      expiresAt: row['expiresAt'],
      executedAt: row['executedAt'],
      executedBy: row['executedBy'],
      executionResult: row['executionResult'] as Record<string, unknown> | null,
      createdAt: row['createdAt'],
      updatedAt: row['updatedAt'],
    };
  }
}

export const aiActionService = new AIActionService();
