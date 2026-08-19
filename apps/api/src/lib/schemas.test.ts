import { describe, it, expect } from 'vitest';
import {
  createCaseSchema,
  updateCaseSchema,
  assignCaseSchema,
  reassignCaseSchema,
  resolveCaseSchema,
  createTaskSchema,
  updateTaskSchema,
  completeTaskSchema,
  blockTaskSchema,
  createSLAPolicySchema,
  updateSLAPolicySchema,
  pauseSLASchema,
  createEscalationSchema,
  createCaseCommentSchema,
} from '@airove/shared';

const UUID = '550e8400-e29b-41d4-a716-446655440000';
const ISO = '2026-01-15T10:30:00.000Z';

// ─── createCaseSchema ───

describe('createCaseSchema', () => {
  it('accepts valid minimal input', () => {
    const result = createCaseSchema.safeParse({ caseType: 'missing' });
    expect(result.success).toBe(true);
  });

  it('accepts valid full input', () => {
    const result = createCaseSchema.safeParse({
      caseType: 'delayed',
      baggageId: UUID,
      flightId: UUID,
      journeyId: UUID,
      title: 'Test Case',
      priority: 'high',
      description: 'A description',
      source: 'operator',
      sourceExceptionId: UUID,
      assignedTo: UUID,
      assignedOrganizationId: UUID,
      metadata: { key: 'value' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing required caseType', () => {
    const result = createCaseSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid caseType', () => {
    const result = createCaseSchema.safeParse({ caseType: 'invalid_type' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID for baggageId', () => {
    const result = createCaseSchema.safeParse({ caseType: 'missing', baggageId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('defaults priority to medium and source to operator', () => {
    const result = createCaseSchema.safeParse({ caseType: 'missing' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe('medium');
      expect(result.data.source).toBe('operator');
    }
  });

  it('rejects empty string title', () => {
    const result = createCaseSchema.safeParse({ caseType: 'missing', title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects title exceeding 255 chars', () => {
    const result = createCaseSchema.safeParse({ caseType: 'missing', title: 'x'.repeat(256) });
    expect(result.success).toBe(false);
  });

  it('accepts 255 char title (boundary)', () => {
    const result = createCaseSchema.safeParse({ caseType: 'missing', title: 'x'.repeat(255) });
    expect(result.success).toBe(true);
  });
});

// ─── updateCaseSchema ───

describe('updateCaseSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = updateCaseSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts valid full update', () => {
    const result = updateCaseSchema.safeParse({
      title: 'Updated',
      description: 'New desc',
      priority: 'critical',
      assignedTo: UUID,
      assignedOrganizationId: UUID,
      resolution: 'Resolved',
      resolutionCode: 'bag_found',
      metadata: { foo: 'bar' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid priority enum', () => {
    const result = updateCaseSchema.safeParse({ priority: 'super_high' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid resolutionCode enum', () => {
    const result = updateCaseSchema.safeParse({ resolutionCode: 'invalid_code' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID in assignedTo', () => {
    const result = updateCaseSchema.safeParse({ assignedTo: 'bad' });
    expect(result.success).toBe(false);
  });

  it('rejects empty string title', () => {
    const result = updateCaseSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });
});

// ─── assignCaseSchema ───

describe('assignCaseSchema', () => {
  it('accepts valid assignedTo', () => {
    const result = assignCaseSchema.safeParse({ assignedTo: UUID });
    expect(result.success).toBe(true);
  });

  it('accepts with optional assignedOrganizationId', () => {
    const result = assignCaseSchema.safeParse({ assignedTo: UUID, assignedOrganizationId: UUID });
    expect(result.success).toBe(true);
  });

  it('rejects missing assignedTo', () => {
    const result = assignCaseSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID', () => {
    const result = assignCaseSchema.safeParse({ assignedTo: 'not-uuid' });
    expect(result.success).toBe(false);
  });
});

// ─── reassignCaseSchema ───

describe('reassignCaseSchema', () => {
  it('accepts valid input with reason', () => {
    const result = reassignCaseSchema.safeParse({ assignedTo: UUID, reason: 'Workload balance' });
    expect(result.success).toBe(true);
  });

  it('accepts without optional reason', () => {
    const result = reassignCaseSchema.safeParse({ assignedTo: UUID });
    expect(result.success).toBe(true);
  });

  it('rejects missing assignedTo', () => {
    const result = reassignCaseSchema.safeParse({ reason: 'reason' });
    expect(result.success).toBe(false);
  });

  it('rejects empty string reason', () => {
    const result = reassignCaseSchema.safeParse({ assignedTo: UUID, reason: '' });
    expect(result.success).toBe(false);
  });

  it('rejects reason exceeding 1000 chars', () => {
    const result = reassignCaseSchema.safeParse({ assignedTo: UUID, reason: 'x'.repeat(1001) });
    expect(result.success).toBe(false);
  });
});

// ─── resolveCaseSchema ───

describe('resolveCaseSchema', () => {
  it('accepts valid resolution', () => {
    const result = resolveCaseSchema.safeParse({ resolution: 'Bag located', resolutionCode: 'bag_found' });
    expect(result.success).toBe(true);
  });

  it('rejects missing resolution', () => {
    const result = resolveCaseSchema.safeParse({ resolutionCode: 'bag_found' });
    expect(result.success).toBe(false);
  });

  it('rejects missing resolutionCode', () => {
    const result = resolveCaseSchema.safeParse({ resolution: 'Done' });
    expect(result.success).toBe(false);
  });

  it('rejects empty resolution string', () => {
    const result = resolveCaseSchema.safeParse({ resolution: '', resolutionCode: 'delivered' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid resolutionCode', () => {
    const result = resolveCaseSchema.safeParse({ resolution: 'Done', resolutionCode: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects resolution exceeding 2000 chars', () => {
    const result = resolveCaseSchema.safeParse({ resolution: 'x'.repeat(2001), resolutionCode: 'other' });
    expect(result.success).toBe(false);
  });
});

// ─── createTaskSchema ───

describe('createTaskSchema', () => {
  it('accepts valid minimal input', () => {
    const result = createTaskSchema.safeParse({ title: 'Investigate', taskType: 'investigate' });
    expect(result.success).toBe(true);
  });

  it('accepts full valid input', () => {
    const result = createTaskSchema.safeParse({
      caseId: UUID,
      baggageId: UUID,
      title: 'Locate bag',
      description: 'Find the bag',
      taskType: 'locate_bag',
      priority: 'high',
      assignedTo: UUID,
      assignedOrganizationId: UUID,
      dueAt: ISO,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing title', () => {
    const result = createTaskSchema.safeParse({ taskType: 'investigate' });
    expect(result.success).toBe(false);
  });

  it('rejects missing taskType', () => {
    const result = createTaskSchema.safeParse({ title: 'Do something' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid taskType', () => {
    const result = createTaskSchema.safeParse({ title: 'X', taskType: 'nonexistent' });
    expect(result.success).toBe(false);
  });

  it('defaults priority to medium', () => {
    const result = createTaskSchema.safeParse({ title: 'T', taskType: 'other' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe('medium');
    }
  });

  it('accepts optional fields omitted', () => {
    const result = createTaskSchema.safeParse({ title: 'T', taskType: 'update_status' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.caseId).toBeUndefined();
      expect(result.data.assignedTo).toBeUndefined();
    }
  });
});

// ─── updateTaskSchema ───

describe('updateTaskSchema', () => {
  it('accepts empty object', () => {
    const result = updateTaskSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts valid partial update', () => {
    const result = updateTaskSchema.safeParse({ title: 'Updated', dueAt: ISO, result: 'Found it' });
    expect(result.success).toBe(true);
  });

  it('rejects empty string title', () => {
    const result = updateTaskSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID in assignedTo', () => {
    const result = updateTaskSchema.safeParse({ assignedTo: 'bad-id' });
    expect(result.success).toBe(false);
  });
});

// ─── completeTaskSchema ───

describe('completeTaskSchema', () => {
  it('accepts empty object (result is optional)', () => {
    const result = completeTaskSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts valid result string', () => {
    const result = completeTaskSchema.safeParse({ result: 'Bag delivered successfully' });
    expect(result.success).toBe(true);
  });

  it('rejects empty string result', () => {
    const result = completeTaskSchema.safeParse({ result: '' });
    expect(result.success).toBe(false);
  });

  it('rejects result exceeding 2000 chars', () => {
    const result = completeTaskSchema.safeParse({ result: 'x'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  it('accepts result at exactly 2000 chars', () => {
    const result = completeTaskSchema.safeParse({ result: 'x'.repeat(2000) });
    expect(result.success).toBe(true);
  });

  it('rejects non-string result', () => {
    const result = completeTaskSchema.safeParse({ result: 123 });
    expect(result.success).toBe(false);
  });
});

// ─── blockTaskSchema ───

describe('blockTaskSchema', () => {
  it('accepts valid reason', () => {
    const result = blockTaskSchema.safeParse({ reason: 'Waiting for airline response' });
    expect(result.success).toBe(true);
  });

  it('rejects missing reason', () => {
    const result = blockTaskSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty reason', () => {
    const result = blockTaskSchema.safeParse({ reason: '' });
    expect(result.success).toBe(false);
  });

  it('rejects reason exceeding 1000 chars', () => {
    const result = blockTaskSchema.safeParse({ reason: 'x'.repeat(1001) });
    expect(result.success).toBe(false);
  });
});

// ─── createSLAPolicySchema ───

describe('createSLAPolicySchema', () => {
  it('accepts valid input with defaults', () => {
    const result = createSLAPolicySchema.safeParse({
      name: 'Missing Bag SLA',
      caseType: 'missing',
      priority: 'high',
      responseMinutes: 30,
      resolutionMinutes: 240,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.warningThresholdPercent).toBe(75);
      expect(result.data.escalationThresholdPercent).toBe(100);
      expect(result.data.pauseOnPendingExternal).toBe(true);
    }
  });

  it('accepts full valid input', () => {
    const result = createSLAPolicySchema.safeParse({
      name: 'Damaged SLA',
      description: 'For damaged bags',
      caseType: 'damaged',
      priority: 'critical',
      responseMinutes: 15,
      resolutionMinutes: 120,
      warningThresholdPercent: 50,
      escalationThresholdPercent: 80,
      pauseOnPendingExternal: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = createSLAPolicySchema.safeParse({
      caseType: 'missing',
      priority: 'high',
      responseMinutes: 30,
      resolutionMinutes: 240,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing caseType', () => {
    const result = createSLAPolicySchema.safeParse({
      name: 'SLA',
      priority: 'high',
      responseMinutes: 30,
      resolutionMinutes: 240,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing responseMinutes', () => {
    const result = createSLAPolicySchema.safeParse({
      name: 'SLA',
      caseType: 'missing',
      priority: 'high',
      resolutionMinutes: 240,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing resolutionMinutes', () => {
    const result = createSLAPolicySchema.safeParse({
      name: 'SLA',
      caseType: 'missing',
      priority: 'high',
      responseMinutes: 30,
    });
    expect(result.success).toBe(false);
  });

  it('rejects responseMinutes of 0', () => {
    const result = createSLAPolicySchema.safeParse({
      name: 'SLA',
      caseType: 'missing',
      priority: 'high',
      responseMinutes: 0,
      resolutionMinutes: 240,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative resolutionMinutes', () => {
    const result = createSLAPolicySchema.safeParse({
      name: 'SLA',
      caseType: 'missing',
      priority: 'high',
      responseMinutes: 30,
      resolutionMinutes: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects warningThresholdPercent > 100', () => {
    const result = createSLAPolicySchema.safeParse({
      name: 'SLA',
      caseType: 'missing',
      priority: 'high',
      responseMinutes: 30,
      resolutionMinutes: 240,
      warningThresholdPercent: 101,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid caseType enum', () => {
    const result = createSLAPolicySchema.safeParse({
      name: 'SLA',
      caseType: 'unknown_type',
      priority: 'high',
      responseMinutes: 30,
      resolutionMinutes: 240,
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty string description (optional)', () => {
    const result = createSLAPolicySchema.safeParse({
      name: 'SLA',
      caseType: 'missing',
      priority: 'low',
      responseMinutes: 60,
      resolutionMinutes: 480,
      description: undefined,
    });
    expect(result.success).toBe(true);
  });
});

// ─── updateSLAPolicySchema ───

describe('updateSLAPolicySchema', () => {
  it('accepts empty object', () => {
    const result = updateSLAPolicySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial update', () => {
    const result = updateSLAPolicySchema.safeParse({ name: 'Updated SLA', enabled: false });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = updateSLAPolicySchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects responseMinutes of 0', () => {
    const result = updateSLAPolicySchema.safeParse({ responseMinutes: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects escalationThresholdPercent > 100', () => {
    const result = updateSLAPolicySchema.safeParse({ escalationThresholdPercent: 150 });
    expect(result.success).toBe(false);
  });
});

// ─── pauseSLASchema ───

describe('pauseSLASchema', () => {
  it('accepts valid reason', () => {
    const result = pauseSLASchema.safeParse({ reason: 'Waiting for passenger callback' });
    expect(result.success).toBe(true);
  });

  it('rejects missing reason', () => {
    const result = pauseSLASchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty reason', () => {
    const result = pauseSLASchema.safeParse({ reason: '' });
    expect(result.success).toBe(false);
  });

  it('rejects reason exceeding 1000 chars', () => {
    const result = pauseSLASchema.safeParse({ reason: 'x'.repeat(1001) });
    expect(result.success).toBe(false);
  });
});

// ─── createEscalationSchema ───

describe('createEscalationSchema', () => {
  it('accepts valid input', () => {
    const result = createEscalationSchema.safeParse({
      caseId: UUID,
      escalationLevel: 'level_2',
      reason: 'SLA breached',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing caseId', () => {
    const result = createEscalationSchema.safeParse({
      escalationLevel: 'level_1',
      reason: 'Escalate',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing escalationLevel', () => {
    const result = createEscalationSchema.safeParse({
      caseId: UUID,
      reason: 'Escalate',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing reason', () => {
    const result = createEscalationSchema.safeParse({
      caseId: UUID,
      escalationLevel: 'level_1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid escalationLevel', () => {
    const result = createEscalationSchema.safeParse({
      caseId: UUID,
      escalationLevel: 'level_5',
      reason: 'Too high',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid UUID caseId', () => {
    const result = createEscalationSchema.safeParse({
      caseId: 'not-a-uuid',
      escalationLevel: 'critical',
      reason: 'Urgent',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty reason', () => {
    const result = createEscalationSchema.safeParse({
      caseId: UUID,
      escalationLevel: 'executive',
      reason: '',
    });
    expect(result.success).toBe(false);
  });
});

// ─── createCaseCommentSchema ───

describe('createCaseCommentSchema', () => {
  it('accepts valid content', () => {
    const result = createCaseCommentSchema.safeParse({ content: 'Looks good' });
    expect(result.success).toBe(true);
  });

  it('rejects missing content', () => {
    const result = createCaseCommentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty content', () => {
    const result = createCaseCommentSchema.safeParse({ content: '' });
    expect(result.success).toBe(false);
  });

  it('rejects content exceeding 5000 chars', () => {
    const result = createCaseCommentSchema.safeParse({ content: 'x'.repeat(5001) });
    expect(result.success).toBe(false);
  });

  it('accepts content at exactly 5000 chars', () => {
    const result = createCaseCommentSchema.safeParse({ content: 'x'.repeat(5000) });
    expect(result.success).toBe(true);
  });

  it('rejects non-string content', () => {
    const result = createCaseCommentSchema.safeParse({ content: 42 });
    expect(result.success).toBe(false);
  });
});
