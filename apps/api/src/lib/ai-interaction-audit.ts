import { db, aiInteractions } from '@airove/db';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from './logger.js';
import { auditLog } from './audit-logger.js';
import type { AIInteractionType } from '@airove/shared';

export interface RecordInteractionParams {
  orgId: string;
  userId: string;
  sessionId?: string;
  interactionType: AIInteractionType;
  details?: Record<string, unknown>;
}

export class AIInteractionAudit {
  async recordInteraction(params: RecordInteractionParams): Promise<void> {
    try {
      await db.insert(aiInteractions).values({
        orgId: params.orgId,
        userId: params.userId,
        sessionId: params.sessionId ?? null,
        interactionType: params.interactionType,
        details: params.details ?? null,
      });

      await auditLog({
        orgId: params.orgId,
        userId: params.userId,
        action: `ai.interaction.${params.interactionType.toLowerCase()}`,
        entityType: 'ai_interaction',
        entityId: params.sessionId,
        changes: JSON.stringify(params.details),
      });

      logger.info(
        { orgId: params.orgId, userId: params.userId, interactionType: params.interactionType },
        'AI interaction recorded',
      );
    } catch (err) {
      logger.error({ err, params }, 'Failed to record AI interaction');
    }
  }

  async getInteractions(
    orgId: string,
    options?: { sessionId?: string; interactionType?: AIInteractionType; page?: number; pageSize?: number },
  ): Promise<{ items: typeof aiInteractions.$inferSelect[]; total: number }> {
    const { sessionId, interactionType, page = 1, pageSize = 50 } = options ?? {};
    const offset = (page - 1) * pageSize;

    const conditions = [eq(aiInteractions['orgId'], orgId)];
    if (sessionId) {
      conditions.push(eq(aiInteractions['sessionId'], sessionId));
    }
    if (interactionType) {
      conditions.push(eq(aiInteractions['interactionType'], interactionType));
    }

    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(aiInteractions)
        .where(where)
        .orderBy(desc(aiInteractions['createdAt']))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: aiInteractions['id'] })
        .from(aiInteractions)
        .where(where),
    ]);

    return {
      items,
      total: countResult.length,
    };
  }
}

export const aiInteractionAudit = new AIInteractionAudit();
