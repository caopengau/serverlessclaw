import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getReputation, updateReputation, computeReputationScore } from './reputation-operations';
import { MEMORY_KEYS } from '../constants';

const mockBase = {
  queryItems: vi.fn(),
  putItem: vi.fn(),
};

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ReputationOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getReputation', () => {
    it('should return null if no reputation record exists', async () => {
      mockBase.queryItems.mockResolvedValue([]);
      const result = await getReputation(mockBase as any, 'agent-1');
      expect(result).toBeNull();
      expect(mockBase.queryItems).toHaveBeenCalledWith(
        expect.objectContaining({
          ExpressionAttributeValues: expect.objectContaining({
            ':pk': `${MEMORY_KEYS.REPUTATION_PREFIX}agent-1`,
          }),
        })
      );
    });

    it('should return agent reputation data if found', async () => {
      const mockItem = {
        agentId: 'agent-1',
        tasksCompleted: 10,
        tasksFailed: 2,
        totalLatencyMs: 12000,
        successRate: 0.833,
        avgLatencyMs: 1200,
        lastActive: Date.now(),
        windowStart: Date.now() - 3600000,
        expiresAt: 0,
      };
      mockBase.queryItems.mockResolvedValue([mockItem]);
      const result = await getReputation(mockBase as any, 'agent-1');
      expect(result).toEqual(mockItem);
    });
  });

  describe('updateReputation', () => {
    it('should accumulate metrics within rolling window', async () => {
      const now = Date.now();
      const existing = {
        agentId: 'agent-1',
        tasksCompleted: 5,
        tasksFailed: 1,
        totalLatencyMs: 5000,
        successRate: 0.833,
        avgLatencyMs: 1000,
        lastActive: now - 3600000,
        windowStart: now - 7200000,
        expiresAt: 0,
      };
      mockBase.queryItems.mockResolvedValue([existing]);

      await updateReputation(mockBase as any, 'agent-1', true, 1000);

      expect(mockBase.putItem).toHaveBeenCalledWith(
        expect.objectContaining({
          tasksCompleted: 6,
          tasksFailed: 1,
          totalLatencyMs: 6000,
          successRate: 6 / 7,
        })
      );
    });

    it('should reset metrics when window expires', async () => {
      const now = Date.now();
      const expired = {
        agentId: 'agent-1',
        tasksCompleted: 100,
        tasksFailed: 20,
        totalLatencyMs: 100000,
        successRate: 0.833,
        avgLatencyMs: 1000,
        lastActive: now - 10 * 86400000,
        windowStart: now - 11 * 86400000,
        expiresAt: 0,
      };
      mockBase.queryItems.mockResolvedValue([expired]);

      await updateReputation(mockBase as any, 'agent-1', true, 2000);

      expect(mockBase.putItem).toHaveBeenCalledWith(
        expect.objectContaining({
          tasksCompleted: 1,
          tasksFailed: 0,
          totalLatencyMs: 2000,
          successRate: 1.0,
        })
      );
    });
  });

  describe('computeReputationScore', () => {
    it('should compute a score between 0 and 1', () => {
      const reputation = {
        agentId: 'agent-1',
        tasksCompleted: 10,
        tasksFailed: 0,
        totalLatencyMs: 10000,
        successRate: 1.0,
        avgLatencyMs: 1000,
        lastActive: Date.now(),
        windowStart: Date.now() - 3600000,
        expiresAt: 0,
      };
      const score = computeReputationScore(reputation);
      expect(score).toBeGreaterThan(0.8);
      expect(score).toBeLessThanOrEqual(1.0);
    });
  });
});
