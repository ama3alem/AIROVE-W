import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockAuditLog } = vi.hoisted(() => ({
  mockDb: {
    insert: vi.fn(),
    update: vi.fn(),
    query: {
      slaPolicies: { findFirst: vi.fn(), findMany: vi.fn() },
      caseSla: { findFirst: vi.fn(), findMany: vi.fn() },
      caseEscalations: { findFirst: vi.fn(), findMany: vi.fn() },
    },
  },
  mockAuditLog: vi.fn(),
}));

vi.mock('@airove/db', () => ({
  db: mockDb,
  slaPolicies: {},
  caseSla: {},
  caseEscalations: {},
  cases: {},
}));

vi.mock('./audit-logger', () => ({ auditLog: mockAuditLog }));

import { SLAService } from './sla-engine';
import { EscalationService, ESCALATION_LEVELS } from './escalation-engine';

function chainableReturn(row: Record<string, unknown>) {
  const returning = vi.fn().mockResolvedValue([row]);
  const whereReturning = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where: whereReturning });
  const values = vi.fn().mockReturnValue({ returning });
  mockDb.insert.mockReturnValue({ values });
  mockDb.update.mockReturnValue({ set });
}

const ORG = 'org-1';
const CASE_ID = 'case-1';
const POLICY_ID = 'policy-1';
const SLA_ID = 'sla-1';
const ESC_ID = 'esc-1';

const POLICY_ROW = {
  id: POLICY_ID,
  orgId: ORG,
  name: 'P1 Policy',
  caseType: 'incident',
  priority: 'critical',
  responseMinutes: 30,
  resolutionMinutes: 120,
  warningThresholdPercent: 75,
  escalationThresholdPercent: 100,
  enabled: true,
  createdAt: new Date('2025-01-01T00:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// SLA Engine
// ─────────────────────────────────────────────────────────────────────────────
describe('SLAService', () => {
  const sla = new SLAService();

  describe('startSLA', () => {
    it('calculates responseDueAt and resolutionDueAt from policy minutes', async () => {
      mockDb.query.slaPolicies.findFirst.mockResolvedValue(POLICY_ROW);

      const now = new Date();
      const slaRow = {
        id: SLA_ID,
        caseId: CASE_ID,
        orgId: ORG,
        slaPolicyId: POLICY_ID,
        status: 'active',
        responseDueAt: new Date(now.getTime() + 30 * 60_000),
        resolutionDueAt: new Date(now.getTime() + 120 * 60_000),
      };
      chainableReturn(slaRow);

      const result = await sla.startSLA(CASE_ID, ORG, POLICY_ID);

      expect(result.status).toBe('active');
      const responseMs = result.responseDueAt.getTime() - now.getTime();
      const resolutionMs = result.resolutionDueAt.getTime() - now.getTime();
      expect(responseMs).toBeCloseTo(30 * 60_000, -3);
      expect(resolutionMs).toBeCloseTo(120 * 60_000, -3);
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'sla.start' }),
      );
    });

    it('throws if policy not found', async () => {
      mockDb.query.slaPolicies.findFirst.mockResolvedValue(undefined);
      await expect(sla.startSLA(CASE_ID, ORG, POLICY_ID)).rejects.toThrow('SLA policy not found');
    });
  });

  describe('pauseSLA', () => {
    it('validates SLA is active before pausing', async () => {
      mockDb.query.caseSla.findFirst.mockResolvedValue({
        id: SLA_ID, caseId: CASE_ID, orgId: ORG, status: 'active', pausedAt: null, totalPausedMs: 0,
      });
      chainableReturn({ id: SLA_ID, status: 'paused', pausedAt: new Date() });

      const result = await sla.pauseSLA(CASE_ID, ORG, 'awaiting vendor');
      expect(result.status).toBe('paused');
    });

    it('throws when SLA is already paused', async () => {
      mockDb.query.caseSla.findFirst.mockResolvedValue({
        id: SLA_ID, caseId: CASE_ID, orgId: ORG, status: 'paused', pausedAt: new Date(), totalPausedMs: 0,
      });
      await expect(sla.pauseSLA(CASE_ID, ORG, 'reason')).rejects.toThrow("Cannot pause SLA in status 'paused'");
    });

    it('throws when SLA is already breached', async () => {
      mockDb.query.caseSla.findFirst.mockResolvedValue({
        id: SLA_ID, caseId: CASE_ID, orgId: ORG, status: 'breached', pausedAt: null, totalPausedMs: 0,
      });
      await expect(sla.pauseSLA(CASE_ID, ORG, 'reason')).rejects.toThrow("Cannot pause SLA in status 'breached'");
    });
  });

  describe('resumeSLA', () => {
    it('calculates totalPausedMs correctly', async () => {
      const pausedAt = new Date(Date.now() - 10 * 60_000);
      mockDb.query.caseSla.findFirst.mockResolvedValue({
        id: SLA_ID, caseId: CASE_ID, orgId: ORG, status: 'paused', pausedAt, totalPausedMs: 5 * 60_000,
      });
      chainableReturn({
        id: SLA_ID, status: 'active', pausedAt: null, totalPausedMs: 15 * 60_000,
      });

      const result = await sla.resumeSLA(CASE_ID, ORG);
      expect(result.totalPausedMs).toBe(15 * 60_000);
      expect(result.pausedAt).toBeNull();
    });

    it('validates SLA is paused before resuming', async () => {
      mockDb.query.caseSla.findFirst.mockResolvedValue({
        id: SLA_ID, caseId: CASE_ID, orgId: ORG, status: 'active', pausedAt: null, totalPausedMs: 0,
      });
      await expect(sla.resumeSLA(CASE_ID, ORG)).rejects.toThrow("Cannot resume SLA in status 'active'");
    });

    it('throws when no SLA found', async () => {
      mockDb.query.caseSla.findFirst.mockResolvedValue(undefined);
      await expect(sla.resumeSLA(CASE_ID, ORG)).rejects.toThrow('No SLA found for case');
    });
  });

  describe('checkSLABreach', () => {
    it('detects breach when now > resolutionDueAt + pausedMs', async () => {
      const resolutionDueAt = new Date(Date.now() - 60_000);
      mockDb.query.caseSla.findFirst.mockResolvedValue({
        id: SLA_ID, caseId: CASE_ID, orgId: ORG, status: 'active',
        pausedAt: null, totalPausedMs: 0, resolutionDueAt, createdAt: new Date(Date.now() - 120 * 60_000),
      });
      chainableReturn({ id: SLA_ID, status: 'breached', breachTriggeredAt: new Date() });

      const result = await sla.checkSLABreach(CASE_ID, ORG);
      expect(result!.status).toBe('breached');
    });

    it('does not mark as breached when within deadline', async () => {
      const resolutionDueAt = new Date(Date.now() + 60_000);
      mockDb.query.caseSla.findFirst.mockResolvedValue({
        id: SLA_ID, caseId: CASE_ID, orgId: ORG, status: 'active',
        pausedAt: null, totalPausedMs: 0, resolutionDueAt, createdAt: new Date(),
      });

      const result = await sla.checkSLABreach(CASE_ID, ORG);
      expect(result!.status).toBe('active');
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('accounts for paused time when evaluating breach', async () => {
      const resolutionDueAt = new Date(Date.now() - 30_000);
      mockDb.query.caseSla.findFirst.mockResolvedValue({
        id: SLA_ID, caseId: CASE_ID, orgId: ORG, status: 'active',
        pausedAt: null, totalPausedMs: 60_000, resolutionDueAt, createdAt: new Date(Date.now() - 120 * 60_000),
      });

      const result = await sla.checkSLABreach(CASE_ID, ORG);
      expect(result!.status).toBe('active');
    });

    it('returns null when no SLA found', async () => {
      mockDb.query.caseSla.findFirst.mockResolvedValue(undefined);
      const result = await sla.checkSLABreach(CASE_ID, ORG);
      expect(result).toBeNull();
    });
  });

  describe('checkSLAWarning', () => {
    it('triggers warning at warningThresholdPercent', async () => {
      const createdAt = new Date(Date.now() - 90 * 60_000);
      const resolutionDueAt = new Date(Date.now() + 30 * 60_000);
      mockDb.query.caseSla.findFirst.mockResolvedValue({
        id: SLA_ID, caseId: CASE_ID, orgId: ORG, status: 'active',
        slaPolicyId: POLICY_ID, pausedAt: null, totalPausedMs: 0,
        warningTriggeredAt: null, createdAt, resolutionDueAt,
      });
      mockDb.query.slaPolicies.findFirst.mockResolvedValue({
        ...POLICY_ROW,
        resolutionMinutes: 120,
        warningThresholdPercent: 75,
      });
      chainableReturn({ id: SLA_ID, warningTriggeredAt: new Date() });

      const result = await sla.checkSLAWarning(CASE_ID, ORG);
      expect(result!.warningTriggeredAt).toBeTruthy();
    });

    it('does not trigger warning twice when warningTriggeredAt already set', async () => {
      const createdAt = new Date(Date.now() - 90 * 60_000);
      mockDb.query.caseSla.findFirst.mockResolvedValue({
        id: SLA_ID, caseId: CASE_ID, orgId: ORG, status: 'active',
        slaPolicyId: POLICY_ID, pausedAt: null, totalPausedMs: 0,
        warningTriggeredAt: new Date(), createdAt, resolutionDueAt: new Date(Date.now() + 30 * 60_000),
      });
      mockDb.query.slaPolicies.findFirst.mockResolvedValue(POLICY_ROW);

      const result = await sla.checkSLAWarning(CASE_ID, ORG);
      expect(result!.warningTriggeredAt).toBeTruthy();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('does not trigger when elapsed < warningThresholdPercent', async () => {
      const createdAt = new Date(Date.now() - 10 * 60_000);
      mockDb.query.caseSla.findFirst.mockResolvedValue({
        id: SLA_ID, caseId: CASE_ID, orgId: ORG, status: 'active',
        slaPolicyId: POLICY_ID, pausedAt: null, totalPausedMs: 0,
        warningTriggeredAt: null, createdAt, resolutionDueAt: new Date(Date.now() + 110 * 60_000),
      });
      mockDb.query.slaPolicies.findFirst.mockResolvedValue({
        ...POLICY_ROW,
        resolutionMinutes: 120,
        warningThresholdPercent: 75,
      });

      await sla.checkSLAWarning(CASE_ID, ORG);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('getSLATimeRemaining', () => {
    it('calculates correctly including paused time', async () => {
      const now = Date.now();
      const responseDueAt = new Date(now + 15 * 60_000);
      const resolutionDueAt = new Date(now + 45 * 60_000);
      mockDb.query.caseSla.findFirst.mockResolvedValue({
        id: SLA_ID, caseId: CASE_ID, orgId: ORG, status: 'active',
        pausedAt: null, totalPausedMs: 5 * 60_000, responseDueAt, resolutionDueAt,
      });

      const result = await sla.getSLATimeRemaining(CASE_ID, ORG);
      expect(result.responseRemainingMs).toBeCloseTo(20 * 60_000, -3);
      expect(result.resolutionRemainingMs).toBeCloseTo(50 * 60_000, -3);
      expect(result.isResponseOverdue).toBe(false);
      expect(result.isResolutionOverdue).toBe(false);
    });

    it('returns overdue flags when deadlines passed', async () => {
      mockDb.query.caseSla.findFirst.mockResolvedValue({
        id: SLA_ID, caseId: CASE_ID, orgId: ORG, status: 'active',
        pausedAt: null, totalPausedMs: 0,
        responseDueAt: new Date(Date.now() - 10 * 60_000),
        resolutionDueAt: new Date(Date.now() - 5 * 60_000),
      });

      const result = await sla.getSLATimeRemaining(CASE_ID, ORG);
      expect(result.isResponseOverdue).toBe(true);
      expect(result.isResolutionOverdue).toBe(true);
    });

    it('returns zeroed defaults when no SLA found', async () => {
      mockDb.query.caseSla.findFirst.mockResolvedValue(undefined);
      const result = await sla.getSLATimeRemaining(CASE_ID, ORG);
      expect(result.responseRemainingMs).toBe(0);
      expect(result.isResolutionOverdue).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Escalation Engine
// ─────────────────────────────────────────────────────────────────────────────
describe('EscalationService', () => {
  const esc = new EscalationService();

  describe('getNextEscalationLevel', () => {
    it('returns correct next level for level_1', () => {
      expect(esc.getNextEscalationLevel('level_1')).toBe('level_2');
    });

    it('returns correct next level for level_2', () => {
      expect(esc.getNextEscalationLevel('level_2')).toBe('level_3');
    });

    it('returns correct next level for level_3', () => {
      expect(esc.getNextEscalationLevel('level_3')).toBe('critical');
    });

    it('returns correct next level for critical', () => {
      expect(esc.getNextEscalationLevel('critical')).toBe('executive');
    });

    it('returns null for executive (last level)', () => {
      expect(esc.getNextEscalationLevel('executive')).toBeNull();
    });

    it('returns null for unknown level', () => {
      expect(esc.getNextEscalationLevel('unknown_level')).toBeNull();
    });
  });

  describe('escalateForSLA', () => {
    it('determines correct level based on percent overdue', async () => {
      const now = Date.now();
      const createdAt = new Date(now - 60 * 60_000);
      const resolutionDueAt = new Date(now - 60_000);
      mockDb.query.caseSla.findFirst.mockResolvedValue({
        id: SLA_ID, caseId: CASE_ID, orgId: ORG, status: 'active',
        pausedAt: null, totalPausedMs: 0, resolutionDueAt, createdAt,
      });
      chainableReturn({
        id: ESC_ID, caseId: CASE_ID, orgId: ORG, escalationLevel: 'level_1', status: 'pending',
      });

      const result = await esc.escalateForSLA(SLA_ID, CASE_ID, ORG);
      expect(result.escalationLevel).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('throws when SLA record not found', async () => {
      mockDb.query.caseSla.findFirst.mockResolvedValue(undefined);
      await expect(esc.escalateForSLA(SLA_ID, CASE_ID, ORG)).rejects.toThrow('SLA record not found');
    });
  });

  describe('autoEscalate', () => {
    it('only escalates cases without active escalations (dedup)', async () => {
      const now = Date.now();
      const slaRow = {
        id: SLA_ID, caseId: CASE_ID, orgId: ORG, status: 'active',
        pausedAt: null, totalPausedMs: 0,
        resolutionDueAt: new Date(now - 60_000),
        createdAt: new Date(now - 60 * 60_000),
      };
      mockDb.query.caseSla.findMany.mockResolvedValue([slaRow]);
      mockDb.query.caseEscalations.findFirst.mockResolvedValue({
        id: 'existing-esc', caseId: CASE_ID, resolvedAt: null,
      });

      const result = await esc.autoEscalate(ORG);
      expect(result).toHaveLength(0);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('escalates cases with no existing active escalation', async () => {
      const now = Date.now();
      const slaRow = {
        id: SLA_ID, caseId: CASE_ID, orgId: ORG, status: 'active',
        pausedAt: null, totalPausedMs: 0,
        resolutionDueAt: new Date(now - 60_000),
        createdAt: new Date(now - 60 * 60_000),
      };
      mockDb.query.caseSla.findMany.mockResolvedValue([slaRow]);
      mockDb.query.caseEscalations.findFirst.mockResolvedValue(undefined);
      mockDb.query.caseSla.findFirst.mockResolvedValue({
        id: SLA_ID, caseId: CASE_ID, orgId: ORG, status: 'active',
        pausedAt: null, totalPausedMs: 0,
        resolutionDueAt: new Date(now - 60_000),
        createdAt: new Date(now - 60 * 60_000),
      });
      chainableReturn({
        id: ESC_ID, caseId: CASE_ID, orgId: ORG, escalationLevel: 'level_2', status: 'pending',
      });

      const result = await esc.autoEscalate(ORG);
      expect(result).toHaveLength(1);
      expect(result[0]!.caseId).toBe(CASE_ID);
    });

    it('returns empty array when no breached SLAs', async () => {
      mockDb.query.caseSla.findMany.mockResolvedValue([]);
      const result = await esc.autoEscalate(ORG);
      expect(result).toEqual([]);
    });
  });

  describe('acknowledgeEscalation', () => {
    it('validates not already acknowledged', async () => {
      mockDb.query.caseEscalations.findFirst.mockResolvedValue({
        id: ESC_ID, caseId: CASE_ID, orgId: ORG, acknowledgedAt: new Date(),
      });
      await expect(esc.acknowledgeEscalation(ESC_ID, ORG, 'user-1')).rejects.toThrow(
        'Escalation already acknowledged',
      );
    });

    it('acknowledges a pending escalation', async () => {
      mockDb.query.caseEscalations.findFirst.mockResolvedValue({
        id: ESC_ID, caseId: CASE_ID, orgId: ORG, acknowledgedAt: null,
      });
      chainableReturn({
        id: ESC_ID, status: 'acknowledged', acknowledgedAt: new Date(), acknowledgedBy: 'user-1',
      });

      const result = await esc.acknowledgeEscalation(ESC_ID, ORG, 'user-1');
      expect(result.status).toBe('acknowledged');
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'escalation.acknowledge' }),
      );
    });

    it('throws when escalation not found', async () => {
      mockDb.query.caseEscalations.findFirst.mockResolvedValue(undefined);
      await expect(esc.acknowledgeEscalation(ESC_ID, ORG, 'user-1')).rejects.toThrow(
        'Escalation not found',
      );
    });
  });

  describe('resolveEscalation', () => {
    it('validates not already resolved', async () => {
      mockDb.query.caseEscalations.findFirst.mockResolvedValue({
        id: ESC_ID, caseId: CASE_ID, orgId: ORG, resolvedAt: new Date(),
      });
      await expect(esc.resolveEscalation(ESC_ID, ORG, 'user-1')).rejects.toThrow(
        'Escalation already resolved',
      );
    });

    it('resolves a pending escalation', async () => {
      mockDb.query.caseEscalations.findFirst.mockResolvedValue({
        id: ESC_ID, caseId: CASE_ID, orgId: ORG, resolvedAt: null,
      });
      chainableReturn({
        id: ESC_ID, status: 'resolved', resolvedAt: new Date(), resolvedBy: 'user-1',
      });

      const result = await esc.resolveEscalation(ESC_ID, ORG, 'user-1');
      expect(result.status).toBe('resolved');
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'escalation.resolve' }),
      );
    });

    it('throws when escalation not found', async () => {
      mockDb.query.caseEscalations.findFirst.mockResolvedValue(undefined);
      await expect(esc.resolveEscalation(ESC_ID, ORG, 'user-1')).rejects.toThrow(
        'Escalation not found',
      );
    });
  });
});
