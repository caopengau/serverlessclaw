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
    it('scans both global and workspace-scoped items', async () => {
      // Mock global items
      mockBase.scanByPrefix.mockImplementation((prefix) => {
        if (prefix === MEMORY_KEYS.LESSON_PREFIX) {
          return Promise.resolve([{ userId: 'LESSON#1', timestamp: Date.now() }]);
        }
        if (prefix === 'WS#') {
          return Promise.resolve([
            { userId: 'WS#ws-1#LESSON#2', timestamp: Date.now() },
            { userId: 'WS#ws-2#FACT#1', timestamp: Date.now() },
          ]);
        }
        return Promise.resolve([]);
      });

      const health = await analyzer.analyzeMemoryHealth();

      expect(mockBase.scanByPrefix).toHaveBeenCalledWith(
        MEMORY_KEYS.LESSON_PREFIX,
        expect.anything()
      );
      expect(mockBase.scanByPrefix).toHaveBeenCalledWith('WS#', expect.anything());

      // Should find LESSON#1 (global) and LESSON#2 (workspace)
      expect(health.itemsByTier[MEMORY_KEYS.LESSON_PREFIX]).toBe(2);
    });

    it('correctly extracts tier prefixes from scoped userIds', async () => {
      mockBase.scanByPrefix.mockImplementation((prefix) => {
        if (prefix === 'WS#') {
          return Promise.resolve([
            { userId: 'WS#tenant-A#LESSON#abc', timestamp: Date.now() },
            { userId: 'WS#TEAM:t1#STAFF:s1#WSID:ws1#FACT#def', timestamp: Date.now() },
          ]);
        }
        return Promise.resolve([]);
      });

      const health = await analyzer.analyzeMemoryHealth();

      expect(health.itemsByTier[MEMORY_KEYS.LESSON_PREFIX]).toBe(1);
      expect(health.itemsByTier[MEMORY_KEYS.FACT_PREFIX]).toBe(1);
    });
  });
});
