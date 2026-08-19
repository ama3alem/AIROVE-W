import { Hono } from 'hono';
import { authMiddleware, requirePermission } from '../middleware/auth';
import type { AppEnv } from '../types/env';
import { PERMISSIONS } from '@airove/shared';
import { predictionEngine } from '../lib/prediction-engine';
import { riskIntelligenceService } from '../lib/risk-intelligence-service';
import { anomalyDetectionService } from '../lib/anomaly-detection-service';
import { rootCauseService } from '../lib/root-cause-service';
import { recommendationEngine } from '../lib/recommendation-engine';
import { intelligenceService } from '../lib/intelligence-service';
import { aiProviderService } from '../lib/ai-provider-service';
import { aiAssistantService } from '../lib/ai-assistant-service';
import { aiConversationService } from '../lib/ai-conversation-service';
import { aiActionService } from '../lib/ai-action-service';
import { aiToolRegistry } from '../lib/ai-tool-registry';
import {
  assistantRequestSchema,
  createSessionSchema,
  createMessageSchema,
  createActionProposalSchema,
  approvalRequestSchema,
} from '@airove/shared';

const intelligenceRoutes = new Hono<AppEnv>();

intelligenceRoutes.use('*', authMiddleware);

intelligenceRoutes.post(
  '/analyze',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  async (c) => {
    const authCtx = c.get('auth');
    const body = await c.req.json();
    const {
      subjectType,
      subjectId,
      operations,
      predictionType,
      anomalyScanTypes,
    } = body as {
      subjectType: string;
      subjectId: string;
      operations: string[];
      predictionType?: string;
      anomalyScanTypes?: string[];
    };

    if (!subjectType || !subjectId || !operations || !Array.isArray(operations) || operations.length === 0) {
      return c.json({ success: false, error: 'subjectType, subjectId, and operations[] are required' }, 400);
    }

    const validOps = ['prediction', 'risk', 'anomaly', 'root_cause', 'recommendation'];
    const invalidOps = operations.filter((op: string) => !validOps.includes(op));
    if (invalidOps.length > 0) {
      return c.json({ success: false, error: `Invalid operations: ${invalidOps.join(', ')}` }, 400);
    }

    const result = await intelligenceService.analyze({
      orgId: authCtx.orgId,
      userId: authCtx.userId,
      subjectType,
      subjectId,
      operations: operations as Array<'prediction' | 'risk' | 'anomaly' | 'root_cause' | 'recommendation'>,
      predictionType,
      anomalyScanTypes,
    });

    return c.json({ success: true, data: result });
  },
);

intelligenceRoutes.post(
  '/predictions',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  async (c) => {
    const authCtx = c.get('auth');
    const body = await c.req.json();
    const {
      subjectType,
      subjectId,
      predictionType,
      timeHorizonMinutes,
    } = body as {
      subjectType: string;
      subjectId: string;
      predictionType: string;
      timeHorizonMinutes?: number;
    };

    if (!subjectType || !subjectId || !predictionType) {
      return c.json({ success: false, error: 'subjectType, subjectId, and predictionType are required' }, 400);
    }

    const result = await predictionEngine.analyzePrediction({
      orgId: authCtx.orgId,
      subjectType,
      subjectId,
      predictionType: predictionType as Parameters<typeof predictionEngine.analyzePrediction>[0]['predictionType'],
      timeHorizonMinutes,
    });

    return c.json({ success: true, data: result });
  },
);

intelligenceRoutes.post(
  '/risk',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  async (c) => {
    const authCtx = c.get('auth');
    const body = await c.req.json();
    const { subjectType, subjectId } = body as {
      subjectType: string;
      subjectId: string;
    };

    if (!subjectType || !subjectId) {
      return c.json({ success: false, error: 'subjectType and subjectId are required' }, 400);
    }

    const result = await riskIntelligenceService.assessRisk({
      orgId: authCtx.orgId,
      subjectType: subjectType as 'baggage' | 'case' | 'recovery_plan' | 'airport',
      subjectId,
    });

    return c.json({ success: true, data: result });
  },
);

intelligenceRoutes.post(
  '/anomalies',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  async (c) => {
    const authCtx = c.get('auth');
    const body = await c.req.json();
    const { subjectType, subjectId, scanTypes } = body as {
      subjectType: string;
      subjectId: string;
      scanTypes?: string[];
    };

    if (!subjectType || !subjectId) {
      return c.json({ success: false, error: 'subjectType and subjectId are required' }, 400);
    }

    const result = await anomalyDetectionService.detect({
      orgId: authCtx.orgId,
      subjectType: subjectType as 'baggage' | 'case' | 'recovery_plan' | 'airport',
      subjectId,
      scanTypes,
    });

    return c.json({ success: true, data: result });
  },
);

intelligenceRoutes.post(
  '/root-cause',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  async (c) => {
    const authCtx = c.get('auth');
    const body = await c.req.json();
    const { subjectType, subjectId } = body as {
      subjectType: string;
      subjectId: string;
    };

    if (!subjectType || !subjectId) {
      return c.json({ success: false, error: 'subjectType and subjectId are required' }, 400);
    }

    const result = await rootCauseService.analyze({
      orgId: authCtx.orgId,
      subjectType: subjectType as 'baggage' | 'case' | 'recovery_plan',
      subjectId,
    });

    return c.json({ success: true, data: result });
  },
);

intelligenceRoutes.post(
  '/recommendations',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  async (c) => {
    const authCtx = c.get('auth');
    const body = await c.req.json();
    const {
      subjectType,
      subjectId,
      prediction,
      riskAssessment,
      rootCause,
      anomalies,
    } = body as {
      subjectType: string;
      subjectId: string;
      prediction?: Parameters<typeof recommendationEngine.generateRecommendations>[0]['prediction'];
      riskAssessment?: Parameters<typeof recommendationEngine.generateRecommendations>[0]['riskAssessment'];
      rootCause?: Parameters<typeof recommendationEngine.generateRecommendations>[0]['rootCause'];
      anomalies?: Parameters<typeof recommendationEngine.generateRecommendations>[0]['anomalies'];
    };

    if (!subjectType || !subjectId) {
      return c.json({ success: false, error: 'subjectType and subjectId are required' }, 400);
    }

    const result = await recommendationEngine.generateRecommendations({
      orgId: authCtx.orgId,
      subjectType,
      subjectId,
      prediction: prediction as any,
      riskAssessment: riskAssessment as any,
      rootCause: rootCause as any,
      anomalies: anomalies as any,
    });

    return c.json({ success: true, data: result });
  },
);

intelligenceRoutes.get(
  '/providers',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  async (c) => {
    const providers = aiProviderService.listProviders();
    const health = aiProviderService.health();

    return c.json({
      success: true,
      data: {
        providers: providers.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          capabilities: p.capabilities,
          modelVersion: p.modelVersion,
          isActive: p.isActive,
        })),
        health: health.status,
        timestamp: health.timestamp,
      },
    });
  },
);

intelligenceRoutes.get(
  '/providers/health',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  async (c) => {
    const health = aiProviderService.health();
    return c.json({ success: true, data: health });
  },
);

// ─── Layer 8B: AI Operational Interface & Controlled Action Engine ──────────

// Assistant endpoint
intelligenceRoutes.post(
  '/assistant',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  async (c) => {
    const authCtx = c.get('auth');
    const body = await c.req.json();
    const validated = assistantRequestSchema.parse(body);

    const response = await aiAssistantService.processMessage({
      message: validated.message,
      sessionId: validated.sessionId,
      orgId: authCtx.orgId,
      userId: authCtx.userId,
      permissions: authCtx.permissions,
      isSuperAdmin: authCtx.isSuperAdmin,
    });

    return c.json({ success: true, data: response });
  },
);

// Tool registry endpoint
intelligenceRoutes.get(
  '/tools',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  async (c) => {
    const tools = aiToolRegistry.listTools();
    return c.json({
      success: true,
      data: tools.map((t) => ({
        name: t.name,
        description: t.description,
        riskLevel: t.riskLevel,
        classification: t.classification,
        requiredPermission: t.requiredPermission,
      })),
    });
  },
);

// Session management
intelligenceRoutes.get(
  '/sessions',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  async (c) => {
    const authCtx = c.get('auth');
    const query = c.req.query();
    const page = parseInt(query['page'] ?? '1');
    const pageSize = parseInt(query['pageSize'] ?? '20');

    const result = await aiConversationService.listSessions({
      orgId: authCtx.orgId,
      userId: authCtx.userId,
      page,
      pageSize,
    });

    return c.json({ success: true, data: result });
  },
);

intelligenceRoutes.post(
  '/sessions',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  async (c) => {
    const authCtx = c.get('auth');
    const body = await c.req.json();
    const validated = createSessionSchema.parse(body);

    const session = await aiConversationService.createSession({
      orgId: authCtx.orgId,
      userId: authCtx.userId,
      title: validated.title,
      metadata: validated.metadata,
    });

    return c.json({ success: true, data: session });
  },
);

intelligenceRoutes.get(
  '/sessions/:id',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  async (c) => {
    const authCtx = c.get('auth');
    const sessionId = c.req.param('id');

    const session = await aiConversationService.getSession(sessionId, authCtx.orgId);
    if (!session) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } }, 404);
    }

    return c.json({ success: true, data: session });
  },
);

intelligenceRoutes.get(
  '/sessions/:id/messages',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  async (c) => {
    const authCtx = c.get('auth');
    const sessionId = c.req.param('id');
    const query = c.req.query();
    const page = parseInt(query['page'] ?? '1');
    const pageSize = parseInt(query['pageSize'] ?? '50');

    const messages = await aiConversationService.getMessages(sessionId, authCtx.orgId, page, pageSize);
    return c.json({ success: true, data: messages });
  },
);

// Action proposals
intelligenceRoutes.get(
  '/action-proposals',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  async (c) => {
    const authCtx = c.get('auth');
    const query = c.req.query();
    const page = parseInt(query['page'] ?? '1');
    const pageSize = parseInt(query['pageSize'] ?? '20');
    const status = query['status'] as 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED' | 'EXECUTING' | 'EXECUTED' | 'FAILED' | undefined;

    const result = await aiActionService.listProposals(authCtx.orgId, {
      status,
      page,
      pageSize,
    });

    return c.json({ success: true, data: result });
  },
);

intelligenceRoutes.post(
  '/action-proposals',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  async (c) => {
    const authCtx = c.get('auth');
    const body = await c.req.json();
    const validated = createActionProposalSchema.parse(body);

    const proposal = await aiActionService.createProposal({
      orgId: authCtx.orgId,
      creatorId: authCtx.userId,
      actionType: validated.actionType,
      targetType: validated.targetType,
      targetId: validated.targetId,
      reason: validated.reason,
      evidence: validated.evidence,
      confidence: validated.confidence,
      risk: validated.risk,
      requiredApproval: PERMISSIONS.ANALYTICS_VIEW,
      idempotencyKey: validated.idempotencyKey,
    });

    return c.json({ success: true, data: proposal });
  },
);

intelligenceRoutes.get(
  '/action-proposals/:id',
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  async (c) => {
    const authCtx = c.get('auth');
    const proposalId = c.req.param('id');

    const proposal = await aiActionService.getProposal(proposalId, authCtx.orgId);
    if (!proposal) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Proposal not found' } }, 404);
    }

    return c.json({ success: true, data: proposal });
  },
);

intelligenceRoutes.post(
  '/action-proposals/:id/approve',
  requirePermission(PERMISSIONS.RECOVERY_PLAN_APPROVE),
  async (c) => {
    const authCtx = c.get('auth');
    const proposalId = c.req.param('id');
    const body = await c.req.json();
    const validated = approvalRequestSchema.parse(body);

    const proposal = await aiActionService.approveProposal({
      proposalId,
      orgId: authCtx.orgId,
      approverId: authCtx.userId,
      decision: validated.decision,
      reason: validated.reason,
    });

    if (!proposal) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Proposal not found' } }, 404);
    }

    return c.json({ success: true, data: proposal });
  },
);

intelligenceRoutes.post(
  '/action-proposals/:id/execute',
  requirePermission(PERMISSIONS.RECOVERY_PLAN_EXECUTE),
  async (c) => {
    const authCtx = c.get('auth');
    const proposalId = c.req.param('id');

    const result = await aiActionService.executeProposal({
      proposalId,
      orgId: authCtx.orgId,
      userId: authCtx.userId,
      permissions: authCtx.permissions,
      isSuperAdmin: authCtx.isSuperAdmin,
    });

    return c.json({ success: true, data: result });
  },
);

export { intelligenceRoutes };
