import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { BaseMemoryProvider } from './base';
import { addMessage } from './sessions/history-operations';
import { MessageRole } from '../types/llm';

vi.mock('sst', () => ({
  Resource: {
    MemoryTable: {
      name: 'TestMemoryTable',
    },
  },
}));

vi.mock('./tiering', () => ({
  RetentionManager: {
    getExpiresAt: vi.fn().mockResolvedValue({ expiresAt: 1234567890, type: 'msg' }),
  },
}));

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('Silo 4: History Collision Hardening', () => {
  let provider: BaseMemoryProvider;

  beforeEach(() => {
    ddbMock.reset();
    provider = new BaseMemoryProvider(ddbMock as any);
  });

  it('should retry on millisecond collision and use unique micro-timestamps', async () => {
    // 1. First call fails with ConditionalCheckFailedException
    // 2. Second call succeeds
    ddbMock
      .on(PutCommand)
      .rejectsOnce({ name: 'ConditionalCheckFailedException' })
      .resolvesOnce({});

    const message = {
      role: MessageRole.USER,
      content: 'Hello Collision',
    };

    await addMessage(provider, 'user-1', message as any, 'ws-1');

    const putCalls = ddbMock.calls().filter((c) => {
      const input = c.args[0].input as any;
      return c.args[0] instanceof PutCommand && input.Item?.content === 'Hello Collision';
    });

    // Should have retried (1 fail + 1 success)
    expect(putCalls).toHaveLength(2);

    // Verify first call had the existence guard
    const firstCallCommand = putCalls[0].args[0].input as any;
    const firstCallItem = firstCallCommand.Item;
    expect(firstCallCommand.ConditionExpression).toBe(
      'attribute_not_exists(userId) AND attribute_not_exists(#ts)'
    );

    // Verify second call had a DIFFERENT timestamp (the retry logic)
    const secondCallItem = (putCalls[1].args[0].input as any).Item;
    expect(secondCallItem.timestamp).not.toBe(firstCallItem.timestamp);

    // Micro-timestamp should be > ms-timestamp
    expect(secondCallItem.timestamp).toBeGreaterThan(Date.now());
  });

  it('should use micro-timestamps for chronological sorting precision', async () => {
    ddbMock.on(PutCommand).resolves({});

    await addMessage(
      provider,
      'user-1',
      { role: MessageRole.USER, content: 'msg1' } as any,
      'ws-1'
    );

    const putInput = (ddbMock.calls()[0].args[0].input as any).Item;
    const now = Date.now();

    // The timestamp should be significantly larger than now (because it's ms * 1000)
    expect(putInput.timestamp).toBeGreaterThan(now * 100);
    expect(putInput.createdAt).toBeLessThanOrEqual(now);
  });
});
