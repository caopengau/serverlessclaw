import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockSend = vi.fn();

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
    AGENT_VIEW: 'agent:view',
  },
}));

vi.mock('sst', () => ({
  Resource: {
    MemoryTable: { name: 'test-memory-table' },
  },
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class {},
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  ScanCommand: class {
    constructor(public input: unknown) {}
  },
}));

describe('Collaboration API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
  });

  describe('GET', () => {
    it('returns active dispatches on success with workspace scoping', async () => {
      mockSend.mockResolvedValue({
        Items: [
          {
            userId: 'WS#ws-1#PARALLEL#user-123#trace-abc',
            taskCount: 2,
            completedCount: 1,
            initiatorId: 'superclaw',
            sessionId: 'session-xyz',
            status: 'pending',
            metadata: {
              tasks: [
                { taskId: 'task-1', agentId: 'coder', task: 'Build feature' },
                { taskId: 'task-2', agentId: 'critic', task: 'Review code' },
              ],
            },
          },
        ],
      });

      const { GET } = await import('./route');
      const req = new NextRequest('http://localhost/api/collaboration?workspaceId=ws-1');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.activeDispatches).toHaveLength(1);
      expect(data.activeDispatches[0].traceId).toBe('trace-abc');

      // Verify ScanCommand scoping
      const lastCall = mockSend.mock.calls[0][0];
      expect(lastCall.input.FilterExpression).toContain('workspaceId = :ws');
      expect(lastCall.input.ExpressionAttributeValues[':ws']).toBe('ws-1');
    });

    it('returns 403 if user lacks permission', async () => {
      mockHasPermission.mockResolvedValue(false);
      const { GET } = await import('./route');
      const req = new NextRequest('http://localhost/api/collaboration?workspaceId=ws-1');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe('Unauthorized workspace access');
    });

    it('returns empty array on DynamoDB error', async () => {
      mockSend.mockRejectedValue(new Error('DynamoDB error'));

      const { GET } = await import('./route');
      const req = new NextRequest('http://localhost/api/collaboration?workspaceId=ws-1');
      const res = await GET(req);
      const data = await res.json();

      expect(data.activeDispatches).toEqual([]);
    });
  });
});
