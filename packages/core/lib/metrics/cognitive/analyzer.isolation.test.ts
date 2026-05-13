import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthTrendAnalyzer } from './analyzer';
import { MEMORY_KEYS } from '../../constants';

const mockBase = {
  queryItems: vi.fn(),
  scanByPrefix: vi.fn(),
};

vi.mock('../../logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn() },
}));

describe('HealthTrendAnalyzer', () => {
  let analyzer: HealthTrendAnalyzer;

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new HealthTrendAnalyzer(mockBase as any);
  });

  describe('analyzeMemoryHealth', () => {
    it('scans global items when no workspaceId is provided', async () => {
      mockBase.scanByPrefix.mockResolvedValue([]);

      await analyzer.analyzeMemoryHealth();

      expect(mockBase.scanByPrefix).toHaveBeenCalledWith(
        MEMORY_KEYS.LESSON_PREFIX,
        expect.anything()
      );
      expect(mockBase.scanByPrefix).not.toHaveBeenCalledWith(
        `WS#ws-1#${MEMORY_KEYS.LESSON_PREFIX}`,
        expect.anything()
      );
    });

    it('scans workspace-scoped items when workspaceId is provided', async () => {
      mockBase.scanByPrefix.mockResolvedValue([]);

      await analyzer.analyzeMemoryHealth('ws-1');

      expect(mockBase.scanByPrefix).toHaveBeenCalledWith(
        `WS#ws-1#${MEMORY_KEYS.LESSON_PREFIX}`,
        expect.anything()
      );
      expect(mockBase.scanByPrefix).not.toHaveBeenCalledWith(
        MEMORY_KEYS.LESSON_PREFIX,
        expect.anything()
      );
    });

    it('correctly extracts tier prefixes from scoped userIds', async () => {
      mockBase.scanByPrefix.mockImplementation((prefix) => {
        if (prefix.includes(MEMORY_KEYS.LESSON_PREFIX)) {
          return Promise.resolve([
            { userId: `WS#ws-1#${MEMORY_KEYS.LESSON_PREFIX}abc`, timestamp: Date.now() },
          ]);
        }
        if (prefix.includes(MEMORY_KEYS.FACT_PREFIX)) {
          return Promise.resolve([
            { userId: `WS#ws-1#${MEMORY_KEYS.FACT_PREFIX}def`, timestamp: Date.now() },
          ]);
        }
        return Promise.resolve([]);
      });

      const health = await analyzer.analyzeMemoryHealth('ws-1');

      expect(health.itemsByTier[MEMORY_KEYS.LESSON_PREFIX]).toBe(1);
      expect(health.itemsByTier[MEMORY_KEYS.FACT_PREFIX]).toBe(1);
    });
  });
});
