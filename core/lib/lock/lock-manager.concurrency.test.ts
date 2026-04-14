import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LockManager } from './lock-manager';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Mock docClient.send
const mockSend = vi.fn();
vi.mock('@aws-sdk/lib-dynamodb', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    DynamoDBDocumentClient: {
      from: vi.fn().mockReturnValue({
        send: (...args: any[]) => mockSend(...args),
      }),
    },
  };
});

describe('LockManager Concurrency & Cleanup [Sh1]', () => {
  let lockManager: LockManager;
  const lockId = 'test-lock';
  const ownerId = 'agent-1';

  beforeEach(() => {
    vi.clearAllMocks();
    lockManager = new LockManager();
  });

  it('should allow acquisition if existing lock is expired', async () => {
    // Simulate expired lock condition check success
    mockSend.mockResolvedValueOnce({});

    const result = await lockManager.acquire(lockId, { ttlSeconds: 10, ownerId });

    expect(result).toBe(true);
    const command = mockSend.mock.calls[0][0] as UpdateCommand;
    expect(command.input.ConditionExpression).toContain('expiresAt < :now');
  });

  it('should succeed in releasing a lock even if it is just expired (ownership cleanup)', async () => {
    // 1. Mock getLockState (GetCommand)
    mockSend.mockResolvedValueOnce({
      Item: {
        ownerId,
        expiresAt: Math.floor(Date.now() / 1000) - 10, // Expired 10 seconds ago
      },
    });
    // 2. Mock release (UpdateCommand)
    mockSend.mockResolvedValueOnce({});

    // The release method should now work as long as owner matches, regardless of expiresAt
    const result = await lockManager.release(lockId, ownerId);

    expect(result).toBe(true);
    // The second call is the UpdateCommand
    const command = mockSend.mock.calls[1][0] as UpdateCommand;
    expect(command.input.ConditionExpression).toBe(
      'attribute_exists(ownerId) OR attribute_not_exists(ownerId)'
    );
  });

  it('should fail release if owner ID does not match', async () => {
    // 1. Mock getLockState (GetCommand)
    mockSend.mockResolvedValueOnce({
      Item: {
        ownerId: 'different-owner',
        expiresAt: Math.floor(Date.now() / 1000) + 10, // Not expired
      },
    });

    const result = await lockManager.release(lockId, ownerId);
    expect(result).toBe(false);
  });
});
