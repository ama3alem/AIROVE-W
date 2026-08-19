import { describe, it, expect } from 'vitest';
import {
  validateCaseTransition,
  isValidCaseTransition,
  getValidTransitions,
  isTerminalStatus,
  isReopenableStatus,
  validateTaskTransition,
  isValidTaskTransition,
} from './case-state-machine.js';

describe('validateCaseTransition', () => {
  it('allows valid transition open -> triaged', () => {
    expect(validateCaseTransition('open', 'triaged')).toEqual({ allowed: true });
  });

  it('allows valid transition open -> assigned', () => {
    expect(validateCaseTransition('open', 'assigned')).toEqual({ allowed: true });
  });

  it('allows valid transition open -> cancelled', () => {
    expect(validateCaseTransition('open', 'cancelled')).toEqual({ allowed: true });
  });

  it('allows valid transition open -> duplicate', () => {
    expect(validateCaseTransition('open', 'duplicate')).toEqual({ allowed: true });
  });

  it('allows valid transition investigating -> resolved', () => {
    expect(validateCaseTransition('investigating', 'resolved')).toEqual({ allowed: true });
  });

  it('allows valid transition resolved -> closed', () => {
    expect(validateCaseTransition('resolved', 'closed')).toEqual({ allowed: true });
  });

  it('allows valid transition resolved -> reopened', () => {
    expect(validateCaseTransition('resolved', 'reopened')).toEqual({ allowed: true });
  });

  it('rejects invalid transition open -> closed', () => {
    const result = validateCaseTransition('open', 'closed');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Cannot transition case');
  });

  it('rejects invalid transition open -> investigating', () => {
    const result = validateCaseTransition('open', 'investigating');
    expect(result.allowed).toBe(false);
  });

  it('rejects transition from terminal status closed -> open', () => {
    const result = validateCaseTransition('closed', 'open');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Cannot transition case');
  });

  it('rejects transition from terminal status cancelled -> open', () => {
    const result = validateCaseTransition('cancelled', 'open');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Allowed: (none)');
  });

  it('rejects transition from terminal status duplicate -> open', () => {
    const result = validateCaseTransition('duplicate', 'open');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Allowed: (none)');
  });

  it('returns error for unknown from status', () => {
    const result = validateCaseTransition('unknown_status', 'open');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Unknown current status 'unknown_status'");
  });

  it('returns reason listing allowed transitions on invalid move', () => {
    const result = validateCaseTransition('triaged', 'investigating');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('assigned');
    expect(result.reason).toContain('cancelled');
  });
});

describe('isValidCaseTransition', () => {
  it('returns true for valid transition', () => {
    expect(isValidCaseTransition('open', 'triaged')).toBe(true);
  });

  it('returns false for invalid transition', () => {
    expect(isValidCaseTransition('open', 'closed')).toBe(false);
  });

  it('returns false for unknown status', () => {
    expect(isValidCaseTransition('bogus', 'open')).toBe(false);
  });
});

describe('validateTaskTransition', () => {
  it('allows valid transition pending -> assigned', () => {
    expect(validateTaskTransition('pending', 'assigned')).toEqual({ allowed: true });
  });

  it('allows valid transition pending -> cancelled', () => {
    expect(validateTaskTransition('pending', 'cancelled')).toEqual({ allowed: true });
  });

  it('allows valid transition in_progress -> blocked', () => {
    expect(validateTaskTransition('in_progress', 'blocked')).toEqual({ allowed: true });
  });

  it('allows valid transition in_progress -> completed', () => {
    expect(validateTaskTransition('in_progress', 'completed')).toEqual({ allowed: true });
  });

  it('allows valid transition blocked -> in_progress', () => {
    expect(validateTaskTransition('blocked', 'in_progress')).toEqual({ allowed: true });
  });

  it('rejects invalid transition pending -> completed', () => {
    const result = validateTaskTransition('pending', 'completed');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Cannot transition task');
  });

  it('rejects transition from terminal status completed', () => {
    const result = validateTaskTransition('completed', 'in_progress');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Allowed: (none)');
  });

  it('rejects transition from terminal status cancelled', () => {
    const result = validateTaskTransition('cancelled', 'pending');
    expect(result.allowed).toBe(false);
  });

  it('returns error for unknown task status', () => {
    const result = validateTaskTransition('unknown_status', 'pending');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Unknown current status 'unknown_status'");
  });
});

describe('isValidTaskTransition', () => {
  it('returns true for valid task transition', () => {
    expect(isValidTaskTransition('assigned', 'in_progress')).toBe(true);
  });

  it('returns false for invalid task transition', () => {
    expect(isValidTaskTransition('pending', 'completed')).toBe(false);
  });

  it('returns false for unknown task status', () => {
    expect(isValidTaskTransition('bogus', 'pending')).toBe(false);
  });
});

describe('getValidTransitions', () => {
  it('returns correct transitions for open', () => {
    expect(getValidTransitions('open')).toEqual(['triaged', 'assigned', 'cancelled', 'duplicate']);
  });

  it('returns correct transitions for investigating', () => {
    expect(getValidTransitions('investigating')).toEqual([
      'action_required', 'in_progress', 'pending_external', 'escalated', 'resolved', 'cancelled',
    ]);
  });

  it('returns correct transitions for resolved', () => {
    expect(getValidTransitions('resolved')).toEqual(['closed', 'reopened']);
  });

  it('returns empty array for terminal status closed', () => {
    expect(getValidTransitions('closed')).toEqual([]);
  });

  it('returns empty array for terminal status cancelled', () => {
    expect(getValidTransitions('cancelled')).toEqual([]);
  });

  it('returns empty array for unknown status', () => {
    expect(getValidTransitions('nonexistent')).toEqual([]);
  });
});

describe('isTerminalStatus', () => {
  it('returns true for closed', () => {
    expect(isTerminalStatus('closed')).toBe(true);
  });

  it('returns true for cancelled', () => {
    expect(isTerminalStatus('cancelled')).toBe(true);
  });

  it('returns true for duplicate', () => {
    expect(isTerminalStatus('duplicate')).toBe(true);
  });

  it('returns false for open', () => {
    expect(isTerminalStatus('open')).toBe(false);
  });

  it('returns false for resolved', () => {
    expect(isTerminalStatus('resolved')).toBe(false);
  });

  it('returns false for unknown status', () => {
    expect(isTerminalStatus('bogus')).toBe(false);
  });
});

describe('isReopenableStatus', () => {
  it('returns true for resolved', () => {
    expect(isReopenableStatus('resolved')).toBe(true);
  });

  it('returns false for open', () => {
    expect(isReopenableStatus('open')).toBe(false);
  });

  it('returns false for closed', () => {
    expect(isReopenableStatus('closed')).toBe(false);
  });

  it('returns false for cancelled', () => {
    expect(isReopenableStatus('cancelled')).toBe(false);
  });

  it('returns false for unknown status', () => {
    expect(isReopenableStatus('bogus')).toBe(false);
  });
});
