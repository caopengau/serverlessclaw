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
    AGENT_DELETE: 'agent:delete',
  },
}));

vi.mock('sst', () => ({
  Resource: {
    App: { name: 'test-app', stage: 'test-stage' },
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
  DeleteCommand: class {
    constructor(public input: unknown) {}
  },
}));

vi.mock('@claw/core/lib/constants', () => ({
  HTTP_STATUS: { INTERNAL_SERVER_ERROR: 500, BAD_REQUEST: 400, FORBIDDEN: 403 },
}));

describe('Locks API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
  });

  describe('GET', () => {
    it('returns locks list on success with workspace scoping', async () => {
      const now = Math.floor(Date.now() / 1000);
      mockSend.mockResolvedValue({
        Items: [
          {
            userId: 'WS#ws-1#LOCK#session-1',
            expiresAt: now + 3600,
            acquiredAt: now - 100,
            timestamp: now,
          },
        ],
      });

      const { GET } = await import('./route');
      const req = new NextRequest('http://localhost/api/locks?workspaceId=ws-1');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.locks).toHaveLength(1);
      expect(data.locks[0].lockId).toBe('session-1');

      const lastCall = mockSend.mock.calls[0][0];
      expect(lastCall.input.ExpressionAttributeValues[':scopedPrefix']).toBe('WS#ws-1#LOCK#');
    });

    it('returns 403 if user lacks permission', async () => {
      mockHasPermission.mockResolvedValue(false);
      const { GET } = await import('./route');
      const req = new NextRequest('http://localhost/api/locks?workspaceId=ws-1');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe('Unauthorized workspace access');
    });
  });

  describe('DELETE', () => {
    it('force-releases a specific lock belonging to workspace', async () => {
      mockSend.mockResolvedValue({});

      const { DELETE } = await import('./route');
      const req = new NextRequest(
        'http://localhost/api/locks?lockId=WS%23ws-1%23LOCK%23session-abc&workspaceId=ws-1',
        {
          method: 'DELETE',
        }
      );
      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns 403 when trying to delete lock from another workspace', async () => {
      const { DELETE } = await import('./route');
      const req = new NextRequest(
        'http://localhost/api/locks?lockId=WS%23other-ws%23LOCK%23session-abc&workspaceId=ws-1',
        {
          method: 'DELETE',
        }
      );
      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe('Lock belongs to another workspace');
    });
  });
});
