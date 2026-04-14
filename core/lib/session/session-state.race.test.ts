import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { SessionStateManager } from './session-state';

const ddbMock = mockClient(DynamoDBDocumentClient);

vi.mock('sst', () => ({
  Resource: {
    MemoryTable: { name: 'test-memory-table' },
  },
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('SessionStateManager Race Conditions', () => {
  let sessionStateManager: SessionStateManager;

  beforeEach(() => {
    ddbMock.reset();
    sessionStateManager = new SessionStateManager();
  });

  it('fix verified: removePendingMessage uses optimistic locking to prevent message loss', async () => {
    const initialMessages = [
      { id: 'msg-A', content: 'A' },
      { id: 'msg-B', content: 'B' },
    ];

    ddbMock.on(GetCommand).resolves({
      Item: {
        pendingMessages: initialMessages,
      },
    });

    ddbMock.on(UpdateCommand).resolves({});

    await sessionStateManager.removePendingMessage('session-1', 'msg-A');

    const updateCall = ddbMock.calls().find((c) => c.args[0] instanceof UpdateCommand)?.args[0]
      .input as UpdateCommandInput;

    expect(updateCall).toBeDefined();
    expect(updateCall.UpdateExpression).toContain('SET pendingMessages = :filtered');
    expect(updateCall.ExpressionAttributeValues?.[':filtered']).toEqual([
      { id: 'msg-B', content: 'B' },
    ]);

    // FIX VERIFIED: ConditionExpression now exists to check for list drift
    expect(updateCall.ConditionExpression).toBe('pendingMessages = :old');
    expect(updateCall.ExpressionAttributeValues?.[':old']).toEqual(initialMessages);
  });
});
