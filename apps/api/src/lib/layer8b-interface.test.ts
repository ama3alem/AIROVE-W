import { describe, it, expect } from 'vitest';
import {
  assistantRequestSchema,
  createSessionSchema,
  createMessageSchema,
  createActionProposalSchema,
  approvalRequestSchema,
  aiConversationStatusEnum,
  aiMessageRoleEnum,
  aiActionTypeEnum,
  aiActionStatusEnum,
  aiApprovalDecisionEnum,
  aiConfidenceEnum,
  aiResponseModeEnum,
  aiToolClassificationEnum,
  aiInteractionTypeEnum,
  aiEvidenceSchema,
} from '@airove/shared';

describe('Layer 8B: Shared Types & Schemas', () => {
  describe('Zod Enums', () => {
    it('validates AIConversationStatus', () => {
      expect(aiConversationStatusEnum.parse('ACTIVE')).toBe('ACTIVE');
      expect(aiConversationStatusEnum.parse('CLOSED')).toBe('CLOSED');
      expect(aiConversationStatusEnum.parse('EXPIRED')).toBe('EXPIRED');
      expect(() => aiConversationStatusEnum.parse('INVALID')).toThrow();
    });

    it('validates AIMessageRole', () => {
      expect(aiMessageRoleEnum.parse('USER')).toBe('USER');
      expect(aiMessageRoleEnum.parse('ASSISTANT')).toBe('ASSISTANT');
      expect(aiMessageRoleEnum.parse('SYSTEM')).toBe('SYSTEM');
      expect(aiMessageRoleEnum.parse('TOOL')).toBe('TOOL');
      expect(() => aiMessageRoleEnum.parse('ADMIN')).toThrow();
    });

    it('validates AIActionType', () => {
      expect(aiActionTypeEnum.parse('ASSIGN_CASE')).toBe('ASSIGN_CASE');
      expect(aiActionTypeEnum.parse('CREATE_TASK')).toBe('CREATE_TASK');
      expect(aiActionTypeEnum.parse('CREATE_RECOVERY_PLAN')).toBe('CREATE_RECOVERY_PLAN');
      expect(aiActionTypeEnum.parse('ESCALATE_CASE')).toBe('ESCALATE_CASE');
      expect(() => aiActionTypeEnum.parse('INVALID_ACTION')).toThrow();
    });

    it('validates AIActionStatus', () => {
      expect(aiActionStatusEnum.parse('PENDING_APPROVAL')).toBe('PENDING_APPROVAL');
      expect(aiActionStatusEnum.parse('APPROVED')).toBe('APPROVED');
      expect(aiActionStatusEnum.parse('REJECTED')).toBe('REJECTED');
      expect(aiActionStatusEnum.parse('EXECUTED')).toBe('EXECUTED');
      expect(() => aiActionStatusEnum.parse('INVALID_STATUS')).toThrow();
    });

    it('validates AIApprovalDecision', () => {
      expect(aiApprovalDecisionEnum.parse('APPROVED')).toBe('APPROVED');
      expect(aiApprovalDecisionEnum.parse('REJECTED')).toBe('REJECTED');
      expect(() => aiApprovalDecisionEnum.parse('PENDING')).toThrow();
    });

    it('validates AIConfidence', () => {
      expect(aiConfidenceEnum.parse('LOW')).toBe('LOW');
      expect(aiConfidenceEnum.parse('MEDIUM')).toBe('MEDIUM');
      expect(aiConfidenceEnum.parse('HIGH')).toBe('HIGH');
      expect(() => aiConfidenceEnum.parse('VERY_HIGH')).toThrow();
    });

    it('validates AIResponseMode', () => {
      expect(aiResponseModeEnum.parse('AI_ASSISTED')).toBe('AI_ASSISTED');
      expect(aiResponseModeEnum.parse('DETERMINISTIC_FALLBACK')).toBe('DETERMINISTIC_FALLBACK');
      expect(aiResponseModeEnum.parse('NO_PROVIDER')).toBe('NO_PROVIDER');
      expect(() => aiResponseModeEnum.parse('UNKNOWN')).toThrow();
    });

    it('validates AIToolClassification', () => {
      expect(aiToolClassificationEnum.parse('READ_ONLY')).toBe('READ_ONLY');
      expect(aiToolClassificationEnum.parse('LOW_IMPACT')).toBe('LOW_IMPACT');
      expect(aiToolClassificationEnum.parse('MEDIUM_IMPACT')).toBe('MEDIUM_IMPACT');
      expect(aiToolClassificationEnum.parse('HIGH_IMPACT')).toBe('HIGH_IMPACT');
      expect(aiToolClassificationEnum.parse('CRITICAL')).toBe('CRITICAL');
      expect(() => aiToolClassificationEnum.parse('DANGEROUS')).toThrow();
    });

    it('validates AIInteractionType', () => {
      expect(aiInteractionTypeEnum.parse('SESSION_CREATED')).toBe('SESSION_CREATED');
      expect(aiInteractionTypeEnum.parse('TOOL_REQUESTED')).toBe('TOOL_REQUESTED');
      expect(aiInteractionTypeEnum.parse('PROMPT_INJECTION_BLOCKED')).toBe('PROMPT_INJECTION_BLOCKED');
      expect(() => aiInteractionTypeEnum.parse('UNKNOWN_INTERACTION')).toThrow();
    });
  });

  describe('Request Schemas', () => {
    it('validates assistantRequestSchema', () => {
      const valid = assistantRequestSchema.parse({ message: 'What is the status of bag 123456?' });
      expect(valid.message).toBe('What is the status of bag 123456?');
      expect(valid.sessionId).toBeUndefined();
    });

    it('validates assistantRequestSchema with sessionId', () => {
      const valid = assistantRequestSchema.parse({
        message: 'Hello',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(valid.sessionId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('rejects empty message', () => {
      expect(() => assistantRequestSchema.parse({ message: '' })).toThrow();
    });

    it('rejects missing message', () => {
      expect(() => assistantRequestSchema.parse({})).toThrow();
    });

    it('validates createSessionSchema', () => {
      const valid = createSessionSchema.parse({ title: 'Test Session' });
      expect(valid.title).toBe('Test Session');
    });

    it('validates createSessionSchema without title', () => {
      const valid = createSessionSchema.parse({});
      expect(valid.title).toBeUndefined();
    });

    it('validates createMessageSchema', () => {
      const valid = createMessageSchema.parse({ content: 'Hello' });
      expect(valid.content).toBe('Hello');
    });

    it('rejects empty content', () => {
      expect(() => createMessageSchema.parse({ content: '' })).toThrow();
    });

    it('validates createActionProposalSchema', () => {
      const valid = createActionProposalSchema.parse({
        actionType: 'ASSIGN_CASE',
        targetType: 'case',
        targetId: 'case-123',
        reason: 'Need to assign this case to a specialist',
      });
      expect(valid.actionType).toBe('ASSIGN_CASE');
      expect(valid.targetType).toBe('case');
      expect(valid.targetId).toBe('case-123');
      expect(valid.reason).toBe('Need to assign this case to a specialist');
    });

    it('rejects invalid actionType', () => {
      expect(() =>
        createActionProposalSchema.parse({
          actionType: 'INVALID',
          targetType: 'case',
          targetId: 'case-123',
          reason: 'Test',
        }),
      ).toThrow();
    });

    it('validates approvalRequestSchema', () => {
      const valid = approvalRequestSchema.parse({ decision: 'APPROVED', reason: 'Looks good' });
      expect(valid.decision).toBe('APPROVED');
      expect(valid.reason).toBe('Looks good');
    });

    it('validates approvalRequestSchema without reason', () => {
      const valid = approvalRequestSchema.parse({ decision: 'REJECTED' });
      expect(valid.decision).toBe('REJECTED');
      expect(valid.reason).toBeUndefined();
    });

    it('rejects invalid decision', () => {
      expect(() => approvalRequestSchema.parse({ decision: 'MAYBE' })).toThrow();
    });
  });

  describe('Evidence Schema', () => {
    it('validates aiEvidenceSchema', () => {
      const valid = aiEvidenceSchema.parse({
        sourceLayer: 'layer3',
        sourceType: 'baggage',
        sourceId: 'bag-123',
        evidenceType: 'FACT',
        description: 'Bag was checked in at JFK',
        confidence: 'HIGH',
        timestamp: new Date(),
      });
      expect(valid.evidenceType).toBe('FACT');
    });

    it('validates aiEvidenceSchema with null timestamp', () => {
      const valid = aiEvidenceSchema.parse({
        sourceLayer: 'layer5',
        sourceType: 'case',
        sourceId: 'case-456',
        evidenceType: 'INFERENCE',
        description: 'Case likely related to baggage delay',
        confidence: 'MEDIUM',
        timestamp: null,
      });
      expect(valid.timestamp).toBeNull();
    });

    it('rejects invalid evidenceType', () => {
      expect(() =>
        aiEvidenceSchema.parse({
          sourceLayer: 'layer3',
          sourceType: 'baggage',
          sourceId: 'bag-123',
          evidenceType: 'GUESS',
          description: 'Test',
          confidence: 'HIGH',
          timestamp: null,
        }),
      ).toThrow();
    });
  });
});

describe('Layer 8B: AI Tool Registry', () => {
  it('exports aiToolRegistry with correct methods', async () => {
    const { aiToolRegistry } = await import('../lib/ai-tool-registry');
    expect(aiToolRegistry).toBeDefined();
    expect(typeof aiToolRegistry.listTools).toBe('function');
    expect(typeof aiToolRegistry.getTool).toBe('function');
    expect(typeof aiToolRegistry.validateToolInput).toBe('function');
  });

  it('lists 10 read-only tools', async () => {
    const { aiToolRegistry } = await import('../lib/ai-tool-registry');
    const tools = aiToolRegistry.listTools();
    expect(tools).toHaveLength(10);
    for (const tool of tools) {
      expect(tool.riskLevel).toBe('READ_ONLY');
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
    }
  });

  it('retrieves tool by name', async () => {
    const { aiToolRegistry } = await import('../lib/ai-tool-registry');
    const tool = aiToolRegistry.getTool('get_baggage');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('get_baggage');
    expect(tool?.requiredPermission).toBe('baggage:read');
  });

  it('returns undefined for unknown tool', async () => {
    const { aiToolRegistry } = await import('../lib/ai-tool-registry');
    const tool = aiToolRegistry.getTool('nonexistent_tool');
    expect(tool).toBeUndefined();
  });

  it('validates correct tool input', async () => {
    const { aiToolRegistry } = await import('../lib/ai-tool-registry');
    const result = aiToolRegistry.validateToolInput('get_baggage', {
      baggageId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid tool input', async () => {
    const { aiToolRegistry } = await import('../lib/ai-tool-registry');
    const result = aiToolRegistry.validateToolInput('get_baggage', {
      baggageId: 'not-a-uuid',
    });
    expect(result.valid).toBe(false);
  });
});
