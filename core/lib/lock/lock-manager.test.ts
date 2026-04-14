import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LockManager } from './lock-manager';
import { UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock('sst', () => ({
  Resource: {
    MemoryTable: { name: 'MemoryTable' },
  },
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class {},
}));

vi.mock('@aws-sdk/lib-dynamodb', async () => {
  const actual = await vi.importActual<any>('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: {
      from: () => ({
        send: (command: any) => mockSend(command),
      }),
    },
  };
});

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('LockManager', () => {
  let lockManager: LockManager;

  beforeEach(() => {
    lockManager = new LockManager();
    mockSend.mockReset();
  });

  describe('acquire', () => {
    it('should return true if lock is acquired successfully', async () => {
      mockSend.mockResolvedValueOnce({}); // UpdateCommand

      const result = await lockManager.acquire('test-lock', {
        ownerId: 'agent-1',
        ttlSeconds: 60,
      });

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
      const input = mockSend.mock.calls[0][0].input;
      expect(input.Key.userId).toBe('LOCK#test-lock');
      expect(input.ExpressionAttributeValues[':owner']).toBe('agent-1');
    });

    it('should return false if lock is already held', async () => {
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(error); // UpdateCommand (failed)

      const result = await lockManager.acquire('test-lock', {
        ownerId: 'agent-2',
        ttlSeconds: 60,
      });

      expect(result).toBe(false);
    });

    it('should throw if dynamo errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('Dynamo Error')); // UpdateCommand (error)

      await expect(
        lockManager.acquire('test-lock', {
          ownerId: 'agent-1',
          ttlSeconds: 60,
        })
      ).rejects.toThrow('Dynamo Error');
    });
  });

  describe('renew', () => {
    it('should return true if lock is renewed by owner', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await lockManager.renew('test-lock', {
        ownerId: 'agent-1',
        ttlSeconds: 60,
      });

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
      const input = mockSend.mock.calls[0][0].input;
      expect(input.ConditionExpression).toBe('ownerId = :owner');
    });

    it('should return false if owner mismatch', async () => {
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(error);

      const result = await lockManager.renew('test-lock', {
        ownerId: 'agent-2',
        ttlSeconds: 60,
      });

      expect(result).toBe(false);
    });
  });

  describe('release', () => {
    it('should return true if lock is released by owner', async () => {
      // First getLockState returns owned by us, not expired
      mockSend.mockResolvedValueOnce({
        Item: { ownerId: 'agent-1', expiresAt: Math.floor(Date.now() / 1000) + 60 },
      });
      // Second call is the actual release
      mockSend.mockResolvedValueOnce({});

      const result = await lockManager.release('test-lock', 'agent-1');

      expect(result).toBe(true);
      // Should have 2 calls: getLockState + release
      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetCommand));
      expect(mockSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
    });

    it('should return true if lock has expired (can cleanup)', async () => {
      // First getLockState returns expired lock
      mockSend.mockResolvedValueOnce({
        Item: { ownerId: null, expiresAt: Math.floor(Date.now() / 1000) - 10 },
      });
      // Second call is the actual release (cleanup)
      mockSend.mockResolvedValueOnce({});

      const result = await lockManager.release('test-lock', 'agent-1');

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should return false if lock is held by different owner and not expired', async () => {
      // First getLockState returns owned by different agent, not expired
      mockSend.mockResolvedValueOnce({
        Item: { ownerId: 'agent-2', expiresAt: Math.floor(Date.now() / 1000) + 60 },
      });

      const result = await lockManager.release('test-lock', 'agent-1');

      expect(result).toBe(false);
      // Only getLockState called, no release attempt
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should return false if release fails conditional check', async () => {
      // First getLockState returns owned by us
      mockSend.mockResolvedValueOnce({
        Item: { ownerId: 'agent-1', expiresAt: Math.floor(Date.now() / 1000) + 60 },
      });
      // Second call fails conditional check
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(error);

      const result = await lockManager.release('test-lock', 'agent-1');

      expect(result).toBe(false);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });
});

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('LockManager', () => {
  let lockManager: LockManager;

  beforeEach(() => {
    lockManager = new LockManager();
    mockSend.mockReset();
  });

  describe('acquire', () => {
    it('should return true if lock is acquired successfully', async () => {
      mockSend.mockResolvedValueOnce({}); // UpdateCommand

      const result = await lockManager.acquire('test-lock', {
        ownerId: 'agent-1',
        ttlSeconds: 60,
      });

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
      const input = mockSend.mock.calls[0][0].input;
      expect(input.Key.userId).toBe('LOCK#test-lock');
      expect(input.ExpressionAttributeValues[':owner']).toBe('agent-1');
    });

    it('should return false if lock is already held', async () => {
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(error); // UpdateCommand (failed)

      const result = await lockManager.acquire('test-lock', {
        ownerId: 'agent-2',
        ttlSeconds: 60,
      });

      expect(result).toBe(false);
    });

    it('should throw if dynamo errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('Dynamo Error')); // UpdateCommand (error)

      await expect(
        lockManager.acquire('test-lock', {
          ownerId: 'agent-1',
          ttlSeconds: 60,
        })
      ).rejects.toThrow('Dynamo Error');
    });
  });

  describe('renew', () => {
    it('should return true if lock is renewed by owner', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await lockManager.renew('test-lock', {
        ownerId: 'agent-1',
        ttlSeconds: 60,
      });

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(expect.any(UpdateCommand));
      const input = mockSend.mock.calls[0][0].input;
      expect(input.ConditionExpression).toBe('ownerId = :owner');
    });

    it('should return false if owner mismatch', async () => {
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(error);

      const result = await lockManager.renew('test-lock', {
        ownerId: 'agent-2',
        ttlSeconds: 60,
      });

      expect(result).toBe(false);
    });
  });

  describe('release', () => {
    it('should return true if lock is released by owner', async () => {
      // First getLockState returns owned by us, not expired
      mockSend.mockResolvedValueOnce({
        Item: { ownerId: 'agent-1', expiresAt: Math.floor(Date.now() / 1000) + 60 },
      });
      // Second call is the actual release
      mockSend.mockResolvedValueOnce({});

      const result = await lockManager.release('test-lock', 'agent-1');

      expect(result).toBe(true);
      // Should have 2 calls: getLockState + release
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should return true if lock has expired (can cleanup)', async () => {
      // First getLockState returns expired lock
      mockSend.mockResolvedValueOnce({
        Item: { ownerId: null, expiresAt: Math.floor(Date.now() / 1000) - 10 },
      });
      // Second call is the actual release (cleanup)
      mockSend.mockResolvedValueOnce({});

      const result = await lockManager.release('test-lock', 'agent-1');

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should return false if lock is held by different owner and not expired', async () => {
      // First getLockState returns owned by different agent, not expired
      mockSend.mockResolvedValueOnce({
        Item: { ownerId: 'agent-2', expiresAt: Math.floor(Date.now() / 1000) + 60 },
      });

      const result = await lockManager.release('test-lock', 'agent-1');

      expect(result).toBe(false);
      // Only getLockState called, no release attempt
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should return false if release fails conditional check', async () => {
      // First getLockState returns owned by us
      mockSend.mockResolvedValueOnce({
        Item: { ownerId: 'agent-1', expiresAt: Math.floor(Date.now() / 1000) + 60 },
      });
      // Second call fails conditional check
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(error);

      const result = await lockManager.release('test-lock', 'agent-1');

      expect(result).toBe(false);
    });
  });
});
