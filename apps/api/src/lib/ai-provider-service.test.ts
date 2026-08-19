import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }) }),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@airove/db', () => ({
  db: mockDb,
  aiProviders: { id: 'id', orgId: 'org_id' },
}));

import { AIProviderService } from './ai-provider-service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AIProviderService', () => {
  const service = new AIProviderService();

  describe('infer', () => {
    it('returns response with deterministic fallback', async () => {
      const result = await service.infer({
        capability: 'TEXT_GENERATION',
        input: { prompt: 'Analyze baggage risk' },
        tenantId: 'org-1',
        userId: 'user-1',
      });
      expect(result).toHaveProperty('providerId');
      expect(result).toHaveProperty('modelVersion');
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('latency');
      expect(result).toHaveProperty('requestId');
      expect(typeof result.latency).toBe('number');
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.providerId).toBe('deterministic');
    });

    it('returns classification output', async () => {
      const result = await service.infer({
        capability: 'CLASSIFICATION',
        input: { text: 'SLA breach risk', labels: ['low', 'medium', 'high'] },
        tenantId: 'org-1',
        userId: 'user-1',
      });
      expect(result.output).toBeDefined();
      expect(result.providerId).toBe('deterministic');
    });

    it('returns embedding output', async () => {
      const result = await service.infer({
        capability: 'EMBEDDING',
        input: { text: 'test text' },
        tenantId: 'org-1',
        userId: 'user-1',
      });
      expect(result.output).toBeDefined();
      expect(Array.isArray(result.output['embedding'])).toBe(true);
    });

    it('returns structured output', async () => {
      const result = await service.infer({
        capability: 'STRUCTURED_OUTPUT',
        input: { prompt: 'generate', schema: { type: 'object' } },
        tenantId: 'org-1',
        userId: 'user-1',
      });
      expect(result.output).toBeDefined();
    });
  });
});
