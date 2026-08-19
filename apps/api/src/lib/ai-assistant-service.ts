import { logger } from './logger';
import { auditLog } from './audit-logger';
import { aiGuardrails } from './ai-guardrails';
import { aiProviderService } from './ai-provider-service';
import { aiConversationService } from './ai-conversation-service';
import { aiToolRegistry } from './ai-tool-registry';
import { aiToolAuthorization } from './ai-tool-authorization';
import { aiEvidenceService } from './ai-evidence-service';
import type { AIResponse, AIEvidence } from '@airove/shared';
import type { ToolExecutionContext } from './ai-tool-registry';

export interface AssistantRequest {
  message: string;
  sessionId?: string;
  orgId: string;
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface AssistantResponse {
  answer: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  mode: 'AI_ASSISTED' | 'DETERMINISTIC_FALLBACK' | 'NO_PROVIDER';
  evidence: AIEvidence[];
  facts: string[];
  inferences: string[];
  recommendations: string[];
  warnings: string[];
  sessionId: string;
  messageId: string;
}

export class AIAssistantService {
  async processMessage(request: AssistantRequest): Promise<AssistantResponse> {
    const startTime = Date.now();

    const guardrailResult = await aiGuardrails.validate({
      tenantId: request.orgId,
      userId: request.userId,
      operation: 'assistant.message',
      inputData: { message: request.message },
    });

    if (!guardrailResult.allowed) {
      await auditLog({
        orgId: request.orgId,
        userId: request.userId,
        action: 'ai.assistant.blocked',
        entityType: 'assistant',
        changes: JSON.stringify({ reason: guardrailResult.reason }),
      });

      return {
        answer: 'I cannot process this request due to security restrictions.',
        confidence: 'HIGH',
        mode: 'DETERMINISTIC_FALLBACK',
        evidence: [],
        facts: [],
        inferences: [],
        recommendations: [],
        warnings: [guardrailResult.reason ?? 'Request blocked by guardrails'],
        sessionId: request.sessionId ?? '',
        messageId: '',
      };
    }

    let sessionId = request.sessionId;
    if (!sessionId) {
      const session = await aiConversationService.createSession({
        orgId: request.orgId,
        userId: request.userId,
        title: request.message.substring(0, 100),
      });
      sessionId = session['id'];
    }

    const userMessage = await aiConversationService.createMessage({
      sessionId,
      orgId: request.orgId,
      role: 'USER',
      content: request.message,
    });

    const context: ToolExecutionContext = {
      orgId: request.orgId,
      userId: request.userId,
      permissions: request.permissions,
      isSuperAdmin: request.isSuperAdmin,
    };

    const evidence = await this.gatherEvidenceFromMessage(request.message, context);

    const responseMode = this.determineResponseMode();

    const answer = this.generateAnswer(request.message, evidence, responseMode);

    const assistantMessage = await aiConversationService.createMessage({
      sessionId,
      orgId: request.orgId,
      role: 'ASSISTANT',
      content: answer,
      evidence: evidence as unknown as Record<string, unknown>[],
      confidence: 'MEDIUM',
      responseMode,
    });

    await auditLog({
      orgId: request.orgId,
      userId: request.userId,
      action: 'ai.assistant.message',
      entityType: 'assistant',
      entityId: sessionId,
      changes: JSON.stringify({
        messageId: assistantMessage['id'],
        responseMode,
        evidenceCount: evidence.length,
      }),
    });

    logger.info(
      { sessionId, orgId: request.orgId, userId: request.userId, responseMode, durationMs: Date.now() - startTime },
      'AI assistant message processed',
    );

    return {
      answer,
      confidence: 'MEDIUM',
      mode: responseMode,
      evidence,
      facts: evidence.filter((e) => e.evidenceType === 'FACT').map((e) => e.description),
      inferences: evidence.filter((e) => e.evidenceType === 'INFERENCE').map((e) => e.description),
      recommendations: evidence.filter((e) => e.evidenceType === 'RECOMMENDATION').map((e) => e.description),
      warnings: guardrailResult.warnings,
      sessionId,
      messageId: assistantMessage['id'],
    };
  }

  private determineResponseMode(): 'AI_ASSISTED' | 'DETERMINISTIC_FALLBACK' | 'NO_PROVIDER' {
    const health = aiProviderService.health();
    const activeProviders = health.providers.filter((p) => p.isActive && p.type !== 'deterministic');

    if (activeProviders.length === 0) {
      return 'NO_PROVIDER';
    }

    return 'AI_ASSISTED';
  }

  private async gatherEvidenceFromMessage(
    message: string,
    context: ToolExecutionContext,
  ): Promise<AIEvidence[]> {
    const evidence: AIEvidence[] = [];

    const baggageMatch = message.match(/bag(?:gage)?\s+(\d{6,})/i);
    if (baggageMatch) {
      const baggageId = baggageMatch[1];
      if (baggageId) {
        try {
          const validation = aiToolRegistry.validateToolInput('get_baggage', { baggageId });
          if (validation.valid) {
            const authResult = await aiToolAuthorization.authorizeTool(
              aiToolRegistry.getTool('get_baggage')!,
              context,
              validation.data as Record<string, unknown>,
            );
            if (authResult.authorized) {
              const gatheredEvidence = await aiEvidenceService.gatherBaggageEvidence(context.orgId, baggageId);
              evidence.push(...gatheredEvidence);
            }
          }
        } catch (err) {
          logger.warn({ err, baggageId }, 'Failed to gather baggage evidence');
        }
      }
    }

    const caseMatch = message.match(/case\s+(\d{6,})/i);
    if (caseMatch) {
      const caseId = caseMatch[1];
      if (caseId) {
        try {
          const validation = aiToolRegistry.validateToolInput('get_case', { caseId });
          if (validation.valid) {
            const authResult = await aiToolAuthorization.authorizeTool(
              aiToolRegistry.getTool('get_case')!,
              context,
              validation.data as Record<string, unknown>,
            );
            if (authResult.authorized) {
              const gatheredEvidence = await aiEvidenceService.gatherCaseEvidence(context.orgId, caseId);
              evidence.push(...gatheredEvidence);
            }
          }
        } catch (err) {
          logger.warn({ err, caseId }, 'Failed to gather case evidence');
        }
      }
    }

    return evidence;
  }

  private generateAnswer(
    message: string,
    evidence: AIEvidence[],
    responseMode: 'AI_ASSISTED' | 'DETERMINISTIC_FALLBACK' | 'NO_PROVIDER',
  ): string {
    if (evidence.length === 0) {
      return `I've received your request. Without specific evidence to reference, I can provide a general response. Your message was: "${message.substring(0, 200)}"`;
    }

    const facts = evidence.filter((e) => e.evidenceType === 'FACT');
    const inferences = evidence.filter((e) => e.evidenceType === 'INFERENCE');

    let answer = `Based on the available evidence:\n\n`;

    if (facts.length > 0) {
      answer += `**Facts:**\n`;
      for (const fact of facts) {
        answer += `- ${fact.description}\n`;
      }
    }

    if (inferences.length > 0) {
      answer += `\n**Inferences:**\n`;
      for (const inference of inferences) {
        answer += `- ${inference.description}\n`;
      }
    }

    if (responseMode === 'NO_PROVIDER') {
      answer += `\n*Note: This analysis was generated using deterministic methods. No AI provider was used.*`;
    }

    return answer;
  }
}

export const aiAssistantService = new AIAssistantService();
