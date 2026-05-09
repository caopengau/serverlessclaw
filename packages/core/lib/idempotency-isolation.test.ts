import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('sst', () => ({
  Resource: { MemoryTable: { name: 'test-table' } },
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class {},
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  PutCommand: vi.fn(),
  GetCommand: vi.fn(),
  DeleteCommand: vi.fn(),
}));

import { GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import {
  getIdempotentResult,
  setIdempotentResult,
  deleteIdempotentKey,
  withIdempotency,
} from './idempotency';

describe('Idempotency Multi-Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('partitions keys by workspaceId in getIdempotentResult', async () => {
    mockSend.mockResolvedValue({ Item: undefined });

    await getIdempotentResult('test-key', 'tenant-1');

    expect(GetCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: {
          userId: 'WS#tenant-1#IDEMPOTENCY#test-key',
          timestamp: 0,
        },
      })
    );
  });

  it('partitions keys by workspaceId in setIdempotentResult', async () => {
    mockSend.mockResolvedValue({});

    await setIdempotentResult('test-key', { result: 'ok' }, 'tenant-1');

    expect(PutCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Item: expect.objectContaining({
          userId: 'WS#tenant-1#IDEMPOTENCY#test-key',
          workspaceId: 'tenant-1',
        }),
      })
    );
  });

  it('partitions keys by workspaceId in deleteIdempotentKey', async () => {
    mockSend.mockResolvedValue({});

    await deleteIdempotentKey('test-key', 'tenant-1');

    expect(DeleteCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: {
          userId: 'WS#tenant-1#IDEMPOTENCY#test-key',
          timestamp: 0,
        },
      })
    );
  });

  it('propagates workspaceId in withIdempotency', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined }); // Cache miss
    mockSend.mockResolvedValueOnce({}); // Cache save

    const operation = vi.fn().mockResolvedValue('fresh');
    await withIdempotency('test-key', operation, 'tenant-1');

    expect(GetCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: expect.objectContaining({ userId: 'WS#tenant-1#IDEMPOTENCY#test-key' }),
      })
    );
    expect(PutCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Item: expect.objectContaining({ userId: 'WS#tenant-1#IDEMPOTENCY#test-key' }),
      })
    );
  });

  it('uses global namespace if workspaceId is missing', async () => {
    mockSend.mockResolvedValue({ Item: undefined });

    await getIdempotentResult('test-key');

    expect(GetCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: {
          userId: 'IDEMPOTENCY#test-key',
          timestamp: 0,
        },
      })
    );
  });
});
