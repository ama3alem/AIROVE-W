import pino from 'pino';

const logger = pino({ name: 'layer5-case-state-machine' });

const CASE_TRANSITIONS: Record<string, string[]> = {
  open: ['triaged', 'assigned', 'cancelled', 'duplicate'],
  triaged: ['assigned', 'cancelled', 'duplicate'],
  assigned: ['investigating', 'action_required', 'cancelled'],
  investigating: ['action_required', 'in_progress', 'pending_external', 'escalated', 'resolved', 'cancelled'],
  action_required: ['in_progress', 'pending_external', 'escalated', 'cancelled'],
  in_progress: ['pending_external', 'escalated', 'resolved', 'cancelled'],
  pending_external: ['in_progress', 'resolved', 'cancelled'],
  resolved: ['closed', 'reopened'],
  closed: [],
  cancelled: [],
  duplicate: [],
};

const TASK_TRANSITIONS: Record<string, string[]> = {
  pending: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['blocked', 'completed', 'cancelled'],
  blocked: ['in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
};

const TERMINAL_STATUSES = new Set(['closed', 'cancelled', 'duplicate']);
const REOPENABLE_STATUSES = new Set(['resolved']);

export function validateCaseTransition(
  from: string,
  to: string,
): { allowed: boolean; reason?: string } {
  const allowed = CASE_TRANSITIONS[from];
  if (!allowed) {
    logger.warn({ from, to }, 'Unknown case status');
    return { allowed: false, reason: `Unknown current status '${from}'` };
  }
  if (!allowed.includes(to)) {
    return {
      allowed: false,
      reason: `Cannot transition case from '${from}' to '${to}'. Allowed: ${allowed.join(', ') || '(none)'}`,
    };
  }
  return { allowed: true };
}

export function isValidCaseTransition(from: string, to: string): boolean {
  return validateCaseTransition(from, to).allowed;
}

export function getValidTransitions(status: string): string[] {
  return CASE_TRANSITIONS[status] ?? [];
}

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isReopenableStatus(status: string): boolean {
  return REOPENABLE_STATUSES.has(status);
}

export function validateTaskTransition(
  from: string,
  to: string,
): { allowed: boolean; reason?: string } {
  const allowed = TASK_TRANSITIONS[from];
  if (!allowed) {
    logger.warn({ from, to }, 'Unknown task status');
    return { allowed: false, reason: `Unknown current status '${from}'` };
  }
  if (!allowed.includes(to)) {
    return {
      allowed: false,
      reason: `Cannot transition task from '${from}' to '${to}'. Allowed: ${allowed.join(', ') || '(none)'}`,
    };
  }
  return { allowed: true };
}

export function isValidTaskTransition(from: string, to: string): boolean {
  return validateTaskTransition(from, to).allowed;
}
