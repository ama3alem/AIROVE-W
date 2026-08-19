import { db, aiConversationSessions, aiMessages } from '@airove/db';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from './logger.js';

export interface CreateSessionParams {
  orgId: string;
  userId: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateMessageParams {
  sessionId: string;
  orgId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  toolCalls?: Record<string, unknown>[];
  evidence?: Record<string, unknown>[];
  confidence?: string;
  responseMode?: string;
  metadata?: Record<string, unknown>;
}

export interface ListSessionsParams {
  orgId: string;
  userId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export class AIConversationService {
  async createSession(params: CreateSessionParams): Promise<typeof aiConversationSessions.$inferSelect> {
    const [session] = await db
      .insert(aiConversationSessions)
      .values({
        orgId: params.orgId,
        userId: params.userId,
        title: params.title ?? null,
        status: 'ACTIVE',
        metadata: params.metadata ?? null,
      })
      .returning();

    if (!session) {
      throw new Error('Failed to create conversation session');
    }

    logger.info({ sessionId: session['id'], orgId: params.orgId, userId: params.userId }, 'AI conversation session created');
    return session;
  }

  async getSession(sessionId: string, orgId: string): Promise<typeof aiConversationSessions.$inferSelect | null> {
    const [session] = await db
      .select()
      .from(aiConversationSessions)
      .where(
        and(
          eq(aiConversationSessions['id'], sessionId),
          eq(aiConversationSessions['orgId'], orgId),
        ),
      )
      .limit(1);

    return session ?? null;
  }

  async closeSession(sessionId: string, orgId: string): Promise<typeof aiConversationSessions.$inferSelect | null> {
    const [session] = await db
      .update(aiConversationSessions)
      .set({
        status: 'CLOSED',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(aiConversationSessions['id'], sessionId),
          eq(aiConversationSessions['orgId'], orgId),
        ),
      )
      .returning();

    return session ?? null;
  }

  async listSessions(params: ListSessionsParams): Promise<{ items: typeof aiConversationSessions.$inferSelect[]; total: number }> {
    const { orgId, userId, status, page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(aiConversationSessions['orgId'], orgId)];
    if (userId) {
      conditions.push(eq(aiConversationSessions['userId'], userId));
    }
    if (status) {
      conditions.push(eq(aiConversationSessions['status'], status));
    }

    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(aiConversationSessions)
        .where(where)
        .orderBy(desc(aiConversationSessions['createdAt']))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: aiConversationSessions['id'] })
        .from(aiConversationSessions)
        .where(where),
    ]);

    return {
      items,
      total: countResult.length,
    };
  }

  async createMessage(params: CreateMessageParams): Promise<typeof aiMessages.$inferSelect> {
    const [message] = await db
      .insert(aiMessages)
      .values({
        sessionId: params.sessionId,
        orgId: params.orgId,
        role: params.role,
        content: params.content,
        toolCalls: params.toolCalls ?? null,
        evidence: params.evidence ?? null,
        confidence: params.confidence ?? null,
        responseMode: params.responseMode ?? null,
        status: 'DELIVERED',
        metadata: params.metadata ?? null,
      })
      .returning();

    if (!message) {
      throw new Error('Failed to create message');
    }

    logger.info({ messageId: message['id'], sessionId: params.sessionId, role: params.role }, 'AI message created');
    return message;
  }

  async getMessages(sessionId: string, orgId: string, page = 1, pageSize = 50): Promise<typeof aiMessages.$inferSelect[]> {
    const offset = (page - 1) * pageSize;

    const messages = await db
      .select()
      .from(aiMessages)
      .where(
        and(
          eq(aiMessages['sessionId'], sessionId),
          eq(aiMessages['orgId'], orgId),
        ),
      )
      .orderBy(aiMessages['createdAt'])
      .limit(pageSize)
      .offset(offset);

    return messages;
  }
}

export const aiConversationService = new AIConversationService();
