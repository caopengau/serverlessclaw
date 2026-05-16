import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from './route';
import { NextRequest } from 'next/server';
import * as ddbUtils from '@claw/core/lib/utils/ddb-client';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

// Mock Logger
vi.mock('@claw/core/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock DDB Client utils
vi.mock('@claw/core/lib/utils/ddb-client', () => ({
  getTraceTableName: vi.fn(() => 'test-trace-table'),
}));

// Mock Next Cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock Auth Utils
vi.mock('@/lib/auth-utils', () => ({
  getUserId: vi.fn(() => 'user-123'),
}));

// Mock Identity Manager
const mockHasPermission = vi.fn().mockResolvedValue(true);
vi.mock('@claw/core/lib/session/identity', () => ({
  getIdentityManager: vi.fn().mockResolvedValue({
    hasPermission: mockHasPermission,
  }),
  Permission: {
    AGENT_DELETE: 'agent:delete',
  },
}));

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('Trace API - DELETE', () => {
  beforeEach(() => {
    ddbMock.reset();
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
  });

  it('returns 400 if traceId is missing', async () => {
    const req = new NextRequest('http://localhost/api/trace');
    const res = await DELETE(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Missing traceId');
  });

  it('returns 403 if user lacks AGENT_DELETE permission', async () => {
    mockHasPermission.mockResolvedValue(false);
    const req = new NextRequest('http://localhost/api/trace?traceId=123&workspaceId=ws-1');
    const res = await DELETE(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized to delete traces');
  });

  it('returns 500 if table name is not found', async () => {
    vi.mocked(ddbUtils.getTraceTableName).mockReturnValueOnce(undefined);

    const req = new NextRequest('http://localhost/api/trace?traceId=123&workspaceId=ws-1');
    const res = await DELETE(req);
    expect(res.status).toBe(500);
  });

  it('deletes a specific traceId with workspace scoping', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ traceId: '123', nodeId: 'node-1' }],
    });
    ddbMock.on(BatchWriteCommand).resolves({
      UnprocessedItems: {},
    });

    const req = new NextRequest('http://localhost/api/trace?traceId=123&workspaceId=ws-1');
    const res = await DELETE(req);
    expect(res.status).toBe(200);

    // Verify QueryCommand had the workspace filter
    const queryCall = ddbMock.commandCalls(QueryCommand)[0];
    expect(queryCall.args[0].input.FilterExpression).toContain('workspaceId = :ws');
    expect(queryCall.args[0].input.ExpressionAttributeValues?.[':ws']).toBe('ws-1');
  });

  it('returns 403 if trace belongs to another workspace', async () => {
    // First query (with filter) returns nothing
    ddbMock.on(QueryCommand, { FilterExpression: 'workspaceId = :ws' }).resolves({
      Items: [],
    });
    // Second query (without filter) returns a count > 0, indicating it exists elsewhere
    ddbMock.on(QueryCommand, { Select: 'COUNT' }).resolves({
      Count: 1,
    });

    const req = new NextRequest('http://localhost/api/trace?traceId=123&workspaceId=ws-1');
    const res = await DELETE(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('Trace belongs to another workspace');
  });

  it('handles "all" traceId purge with workspace scoping', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ traceId: 't1', nodeId: 'n1' }],
      LastEvaluatedKey: undefined,
    });
    ddbMock.on(BatchWriteCommand).resolves({
      UnprocessedItems: {},
    });

    const req = new NextRequest('http://localhost/api/trace?traceId=all&workspaceId=ws-1');
    const res = await DELETE(req);
    expect(res.status).toBe(200);

    // Verify QueryCommand had the workspace index and filter
    const queryCall = ddbMock.commandCalls(QueryCommand)[0];
    expect(queryCall.args[0].input.IndexName).toBe('WorkspaceSummaryIndex');
    expect(queryCall.args[0].input.KeyConditionExpression).toContain('workspaceId = :ws');
    expect(queryCall.args[0].input.ExpressionAttributeValues?.[':ws']).toBe('ws-1');
  });

  it('handles DynamoDB errors', async () => {
    ddbMock.on(QueryCommand).rejects(new Error('DynamoDB Error'));

    const req = new NextRequest('http://localhost/api/trace?traceId=123&workspaceId=ws-1');
    const res = await DELETE(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('DynamoDB Error');
  });
});
