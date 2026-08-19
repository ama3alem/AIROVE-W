import { logger } from './logger.js';
import { auditLog } from './audit-logger.js';
import type { AIToolDefinition, ToolExecutionContext } from './ai-tool-registry.js';

export interface ToolAuthorizationResult {
  authorized: boolean;
  reason?: string;
  requiredPermission?: string;
}

export class AIToolAuthorization {
  async authorizeTool(
    tool: AIToolDefinition,
    context: ToolExecutionContext,
    input: Record<string, unknown>,
  ): Promise<ToolAuthorizationResult> {
    if (!context.orgId || !context.userId) {
      return {
        authorized: false,
        reason: 'Missing required authentication context',
      };
    }

    if (tool.requiresTenantScope && !context.orgId) {
      return {
        authorized: false,
        reason: 'Tool requires tenant scope but no organization context available',
      };
    }

    if (!context.isSuperAdmin) {
      const hasPermission = context.permissions.includes(tool.requiredPermission);
      if (!hasPermission) {
        logger.warn(
          { userId: context.userId, orgId: context.orgId, toolName: tool.name, requiredPermission: tool.requiredPermission },
          'Tool authorization denied: insufficient permissions',
        );
        await auditLog({
          orgId: context.orgId,
          userId: context.userId,
          action: 'ai.tool.denied',
          entityType: 'tool',
          changes: JSON.stringify({
            toolName: tool.name,
            reason: 'insufficient_permissions',
            requiredPermission: tool.requiredPermission,
          }),
        });
        return {
          authorized: false,
          reason: `Insufficient permissions. Required: ${tool.requiredPermission}`,
          requiredPermission: tool.requiredPermission,
        };
      }
    }

    if (tool.riskLevel === 'HIGH_IMPACT' || tool.riskLevel === 'CRITICAL') {
      logger.info(
        { userId: context.userId, orgId: context.orgId, toolName: tool.name, riskLevel: tool.riskLevel },
        'High-risk tool authorization requested',
      );
      await auditLog({
        orgId: context.orgId,
        userId: context.userId,
        action: 'ai.tool.high_risk_request',
        entityType: 'tool',
        changes: JSON.stringify({
          toolName: tool.name,
          riskLevel: tool.riskLevel,
          input: Object.keys(input),
        }),
      });
    }

    await auditLog({
      orgId: context.orgId,
      userId: context.userId,
      action: 'ai.tool.authorized',
      entityType: 'tool',
      changes: JSON.stringify({
        toolName: tool.name,
        riskLevel: tool.riskLevel,
        classification: tool.classification,
      }),
    });

    return { authorized: true };
  }
}

export const aiToolAuthorization = new AIToolAuthorization();
