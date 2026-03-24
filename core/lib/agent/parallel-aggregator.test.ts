import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParallelAggregator } from './parallel-aggregator';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock('sst', () => ({
  Resource: {
    MemoryTable: { name: 'MemoryTable' },
  },
}));

vi.mock('@aws-sdk/client-dynamodb', () => {
  return {
    DynamoDBClient: class {
      send = mockSend;
    },
  };
});

vi.mock('@aws-sdk/lib-dynamodb', async () => {
  const actual = await vi.importActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: {
      from: () => ({
        send: (command: any) => mockSend(command),
      }),
    },
  };
});

describe('ParallelAggregator', () => {
  let aggregator: ParallelAggregator;

  beforeEach(() => {
    aggregator = new ParallelAggregator();
    mockSend.mockReset();
  });

  describe('markAsCompleted', () => {
    it('should return true when marking a pending dispatch as completed', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await aggregator.markAsCompleted('user123', 'trace456', 'success');

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
      const command = mockSend.mock.calls[0][0] as UpdateCommand;
      expect(command.input.ConditionExpression).toContain('#status = :pending');
      expect(command.input.ExpressionAttributeNames?.['#status']).toBe('status');
      expect(command.input.ExpressionAttributeValues?.[':pending']).toBe('pending');
    });

    it('should return false if already completed (ConditionalCheckFailed)', async () => {
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(error);

      const result = await aggregator.markAsCompleted('user123', 'trace456', 'success');

      expect(result).toBe(false);
    });
  });

  describe('addResult', () => {
    it('should include taskId in results_ids set to prevent duplicates', async () => {
      mockSend.mockResolvedValueOnce({
        Attributes: {
          completedCount: 1,
          taskCount: 2,
          results: [],
          status: 'pending',
          initiatorId: 'test',
        },
      });

      await aggregator.addResult('user123', 'trace456', {
        taskId: 'taskA',
        agentId: 'agentA',
        status: 'success',
        result: 'ok',
        durationMs: 100,
      });

      const command = mockSend.mock.calls[0][0] as UpdateCommand;
      expect(command.input.UpdateExpression).toContain('results_ids = list_append');
      expect(command.input.ConditionExpression).toContain('#status = :pending');
      expect(command.input.ExpressionAttributeNames?.['#status']).toBe('status');
      expect(command.input.ConditionExpression).toContain('NOT contains(results_ids, :taskId)');
      expect(command.input.ExpressionAttributeValues?.[':taskId']).toBe('taskA');
    });
  });

  describe('init (Bug 3 regression)', () => {
    it('should write results_ids as an array, not a DynamoDB Set', async () => {
      mockSend.mockResolvedValueOnce({});

      await aggregator.init('user123', 'trace456', 2, 'superclaw', 'session-1');

      expect(mockSend).toHaveBeenCalledWith(expect.any(PutCommand));
      const command = mockSend.mock.calls[0][0] as PutCommand;
      const item = command.input.Item;

      expect(item).toBeDefined();
      expect(Array.isArray(item!.results_ids)).toBe(true);
      expect(item!.results_ids).toEqual([]);
      // Must NOT be a Set — DynamoDB Set type (SS) is incompatible with list_append
      expect(item!.results_ids).not.toBeInstanceOf(Set);
    });

    it('should write results as an empty array', async () => {
      mockSend.mockResolvedValueOnce({});

      await aggregator.init('user123', 'trace456', 2, 'superclaw', 'session-1');

      const command = mockSend.mock.calls[0][0] as PutCommand;
      const item = command.input.Item;

      expect(Array.isArray(item!.results)).toBe(true);
      expect(item!.results).toEqual([]);
    });

    it('should use a valid schema for HK and SK (Fix for ValidationException)', async () => {
      mockSend.mockResolvedValueOnce({});

      await aggregator.init('user123', 'trace456', 2, 'superclaw', 'session-1');

      const command = mockSend.mock.calls[0][0] as PutCommand;
      const item = command.input.Item;

      // HK should be a string with the parallel prefix
      expect(typeof item!.userId).toBe('string');
      expect(item!.userId).toContain('PARALLEL#');
      expect(item!.userId).toContain('user123');
      expect(item!.userId).toContain('trace456');

      // SK (timestamp) MUST be a number
      expect(typeof item!.timestamp).toBe('number');
      expect(item!.timestamp).toBe(0);
    });
  });
});
