import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  getReputation,
  updateReputation,
  getReputations,
  computeReputationScore,
  AgentReputation,
} from './reputation-operations';
import { BaseMemoryProvider } from './base';

vi.mock('sst', () => ({
  Resource: {
    MemoryTable: { name: 'test-memory-table' },
    ConfigTable: { name: 'test-config-table' },
  },
}));

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('Reputation Operations', () => {
  let base: BaseMemoryProvider;

  beforeEach(() => {
    ddbMock.reset();
    vi.clearAllMocks();
    base = new BaseMemoryProvider();
  });

  describe('getReputation', () => {
    it('should return null when no reputation exists', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      const result = await getReputation(base, 'coder');
      expect(result).toBeNull();
    });

    it('should return reputation when record exists', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            userId: 'REPUTATION#coder',
            timestamp: 0,
            agentId: 'coder',
            tasksCompleted: 10,
            tasksFailed: 2,
            totalLatencyMs: 50000,
            successRate: 0.833,
            avgLatencyMs: 5000,
            lastActive: Date.now(),
            windowStart: Date.now() - 3600000,
            expiresAt: Math.floor((Date.now() + 86400000) / 1000),
          },
        ],
      });

      const result = await getReputation(base, 'coder');
      expect(result).not.toBeNull();
      expect(result?.agentId).toBe('coder');
      expect(result?.tasksCompleted).toBe(10);
      expect(result?.tasksFailed).toBe(2);
      expect(result?.successRate).toBeCloseTo(0.833, 2);
    });
  });

  describe('updateReputation', () => {
    it('should create new reputation on first success', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });
      ddbMock.on(PutCommand).resolves({});

      await updateReputation(base, 'coder', true, 3000);

      const putCalls = ddbMock.commandCalls(PutCommand);
      expect(putCalls).toHaveLength(1);

      const item = putCalls[0].args[0].input.Item;
      expect(item?.agentId).toBe('coder');
      expect(item?.tasksCompleted).toBe(1);
      expect(item?.tasksFailed).toBe(0);
      expect(item?.totalLatencyMs).toBe(3000);
      expect(item?.successRate).toBe(1);
      expect(item?.avgLatencyMs).toBe(3000);
    });

    it('should create new reputation on first failure', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });
      ddbMock.on(PutCommand).resolves({});

      await updateReputation(base, 'coder', false, 0);

      const putCalls = ddbMock.commandCalls(PutCommand);
      const item = putCalls[0].args[0].input.Item;
      expect(item?.tasksCompleted).toBe(0);
      expect(item?.tasksFailed).toBe(1);
      expect(item?.successRate).toBe(0);
    });

    it('should accumulate within rolling window', async () => {
      const windowStart = Date.now() - 3600000; // 1 hour ago
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            userId: 'REPUTATION#coder',
            timestamp: 0,
            agentId: 'coder',
            tasksCompleted: 5,
            tasksFailed: 1,
            totalLatencyMs: 25000,
            successRate: 0.833,
            avgLatencyMs: 5000,
            lastActive: windowStart,
            windowStart,
            expiresAt: Math.floor((Date.now() + 86400000) / 1000),
          },
        ],
      });
      ddbMock.on(PutCommand).resolves({});

      await updateReputation(base, 'coder', true, 4000);

      const putCalls = ddbMock.commandCalls(PutCommand);
      const item = putCalls[0].args[0].input.Item;
      expect(item?.tasksCompleted).toBe(6);
      expect(item?.tasksFailed).toBe(1);
      expect(item?.totalLatencyMs).toBe(29000);
      expect(item?.successRate).toBeCloseTo(6 / 7, 3);
    });

    it('should reset window after 7 days', async () => {
      const oldWindowStart = Date.now() - 8 * 24 * 3600 * 1000; // 8 days ago
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            userId: 'REPUTATION#coder',
            timestamp: 0,
            agentId: 'coder',
            tasksCompleted: 100,
            tasksFailed: 10,
            totalLatencyMs: 500000,
            successRate: 0.909,
            avgLatencyMs: 5000,
            lastActive: oldWindowStart,
            windowStart: oldWindowStart,
            expiresAt: 0,
          },
        ],
      });
      ddbMock.on(PutCommand).resolves({});

      await updateReputation(base, 'coder', true, 2000);

      const putCalls = ddbMock.commandCalls(PutCommand);
      const item = putCalls[0].args[0].input.Item;
      // Should reset — only 1 task in new window
      expect(item?.tasksCompleted).toBe(1);
      expect(item?.tasksFailed).toBe(0);
      expect(item?.successRate).toBe(1);
    });
  });

  describe('getReputations', () => {
    it('should fetch multiple reputations in parallel', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          {
            userId: 'REPUTATION#coder',
            timestamp: 0,
            agentId: 'coder',
            tasksCompleted: 10,
            tasksFailed: 0,
            successRate: 1,
          },
        ],
      });

      const results = await getReputations(base, ['coder', 'planner']);
      expect(results.size).toBe(2);
    });
  });

  describe('computeReputationScore', () => {
    it('should return high score for high success rate and low latency', () => {
      const rep: AgentReputation = {
        agentId: 'coder',
        tasksCompleted: 100,
        tasksFailed: 0,
        totalLatencyMs: 100000,
        successRate: 1.0,
        avgLatencyMs: 1000,
        lastActive: Date.now(),
        windowStart: Date.now() - 3600000,
        expiresAt: 0,
      };

      const score = computeReputationScore(rep);
      expect(score).toBeGreaterThan(0.8);
    });

    it('should return low score for low success rate', () => {
      const rep: AgentReputation = {
        agentId: 'coder',
        tasksCompleted: 5,
        tasksFailed: 95,
        totalLatencyMs: 500000,
        successRate: 0.05,
        avgLatencyMs: 100000,
        lastActive: Date.now() - 25 * 3600 * 1000, // 25 hours ago
        windowStart: Date.now() - 86400000,
        expiresAt: 0,
      };

      const score = computeReputationScore(rep);
      expect(score).toBeLessThan(0.2);
    });

    it('should penalize stale agents', () => {
      const recentRep: AgentReputation = {
        agentId: 'recent',
        tasksCompleted: 10,
        tasksFailed: 0,
        totalLatencyMs: 50000,
        successRate: 1.0,
        avgLatencyMs: 5000,
        lastActive: Date.now(),
        windowStart: Date.now() - 3600000,
        expiresAt: 0,
      };

      const staleRep: AgentReputation = {
        ...recentRep,
        agentId: 'stale',
        lastActive: Date.now() - 20 * 3600 * 1000, // 20 hours ago
      };

      const recentScore = computeReputationScore(recentRep);
      const staleScore = computeReputationScore(staleRep);
      expect(recentScore).toBeGreaterThan(staleScore);
    });
  });
});
