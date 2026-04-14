import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pushRecursionEntry, getRecursionDepth, clearRecursionStack } from './recursion-tracker';
import { UpdateCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

// Mock the DynamoDB document client send method
const mockSend = vi.fn();
vi.mock('@aws-sdk/lib-dynamodb', () => {
  return {
    DynamoDBDocumentClient: {
      from: vi.fn().mockReturnValue({
        send: (cmd: any) => mockSend(cmd),
      }),
    },
    UpdateCommand: class {
      constructor(public input: any) {}
    },
    GetCommand: class {
      constructor(public input: any) {}
    },
    DeleteCommand: class {
      constructor(public input: any) {}
    },
  };
});

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(),
}));

describe('recursion-tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('pushRecursionEntry', () => {
    it('should use existence check for first entry', async () => {
      await pushRecursionEntry('trace-1', 5, 'sess-1', 'agent-1');

      expect(mockSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ConditionExpression).toBe('attribute_not_exists(#depth)');
      expect(cmd.input.ExpressionAttributeNames).toEqual({ '#depth': 'depth', '#type': 'type' });
      expect(cmd.input.ExpressionAttributeValues[':depth']).toBe(5);
      expect(cmd.input.Key.timestamp).toBe(0);
    });

    it('should use shorter TTL for mission-critical contexts', async () => {
      // Mission context uses 30 min (1800s) TTL vs normal 1 hour (3600s)
      await pushRecursionEntry('trace-1', 5, 'sess-1', 'agent-1', true);

      const cmd = mockSend.mock.calls[0][0];
      // The expiresAt should be now + 1800 for isMission=true
      const expectedExpires = Math.floor(Date.now() / 1000) + 1800;
      expect(cmd.input.ExpressionAttributeValues[':exp']).toBe(expectedExpires);
    });

    it('should handle ConditionalCheckFailedException by attempting increment', async () => {
      // First call fails with conditional check
      mockSend.mockRejectedValueOnce({ name: 'ConditionalCheckFailedException' });
      // Second call (getRecursionDepth) returns current depth
      mockSend.mockResolvedValueOnce({ Item: { depth: 3 } });
      // Third call (increment update) succeeds
      mockSend.mockResolvedValueOnce({});

      // Should not throw
      await expect(pushRecursionEntry('trace-1', 3, 'sess-1', 'agent-1')).resolves.not.toThrow();

      // Should have attempted increment (3 calls total)
      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it('should handle other errors and log warning', async () => {
      mockSend.mockRejectedValue({ name: 'ValidationError', message: 'Invalid input' });

      // Should not throw, should log warning
      await expect(pushRecursionEntry('trace-1', 3, 'sess-1', 'agent-1')).resolves.not.toThrow();
    });
  });

  describe('getRecursionDepth', () => {
    it('should return 0 if no entry found', async () => {
      mockSend.mockResolvedValue({ Item: undefined });
      const depth = await getRecursionDepth('trace-1');
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetCommand));
      expect(depth).toBe(0);
    });

    it('should return depth from item', async () => {
      mockSend.mockResolvedValue({ Item: { depth: 12 } });
      const depth = await getRecursionDepth('trace-1');
      expect(depth).toBe(12);
    });

    it('should return -1 on error to distinguish from no-entry', async () => {
      mockSend.mockRejectedValue({ name: 'ResourceNotFoundException' });
      const depth = await getRecursionDepth('trace-1');
      expect(depth).toBe(-1);
    });
  });

  describe('clearRecursionStack', () => {
    it('should use conditional delete based on attribute_exists(depth)', async () => {
      await clearRecursionStack('trace-1');

      expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteCommand));
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ConditionExpression).toBe('attribute_exists(#depth)');
      expect(cmd.input.ExpressionAttributeNames).toEqual({ '#depth': 'depth' });
      expect(cmd.input.Key.timestamp).toBe(0);
    });
  });
});
