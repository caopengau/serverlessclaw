import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

const mockGetRawConfig = vi.fn();
const mockGetUser = vi.fn();
const mockHasPermission = vi.fn().mockResolvedValue(true);
const mockCreateWorkspace = vi.fn();
const mockInviteMember = vi.fn();

// Mock core config registry
vi.mock('@claw/core/lib/registry/config', () => ({
  ConfigManager: {
    getRawConfig: mockGetRawConfig,
  },
}));

// Mock core identity
vi.mock('@claw/core/lib/session/identity', () => ({
  getIdentityManager: vi.fn().mockResolvedValue({
    getUser: mockGetUser,
    hasPermission: mockHasPermission,
  }),
  Permission: {
    WORKSPACE_MEMBERS: 'WORKSPACE_MEMBERS',
  },
}));

vi.mock('@claw/core/lib/session/identity/types', () => ({
  UserRole: {
    OWNER: 'OWNER',
    ADMIN: 'ADMIN',
    USER: 'USER',
  },
}));

// Mock workspace operations
vi.mock('@claw/core/lib/memory/workspace-operations', () => ({
  createWorkspace: mockCreateWorkspace,
  inviteMember: mockInviteMember,
}));

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  getUserId: vi.fn().mockReturnValue('test-user'),
}));

// Mock @/lib/api-handler
vi.mock('@/lib/api-handler', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  class MockApiError extends Error {
    constructor(
      public message: string,
      public status: number = 500
    ) {
      super(message);
      this.name = 'ApiError';
    }
  }
  return {
    ...actual,
    ApiError: MockApiError,
    withApiHandler:
      (handler: (body: unknown, req: NextRequest) => Promise<unknown>) =>
      async (req: NextRequest) => {
        try {
          const body = req.method === 'POST' ? await req.json() : {};
          const result = await handler(body, req);
          return Response.json(result);
        } catch (e: unknown) {
          const err = e as { message: string; status?: number };
          return Response.json({ error: err.message }, { status: err.status || 500 });
        }
      },
  };
});

describe('Workspace API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 401 if user not found', async () => {
      mockGetUser.mockResolvedValueOnce(null);
      const req = new NextRequest('http://localhost/api/workspaces');
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('filters workspaces by membership for regular user', async () => {
      mockGetUser.mockResolvedValueOnce({
        userId: 'test-user',
        role: 'USER',
        workspaceIds: ['ws-1'],
      });
      mockGetRawConfig.mockImplementation((key) => {
        if (key === 'workspace_index') return ['ws-1', 'ws-2'];
        if (key === 'workspace:ws-1') return { workspaceId: 'ws-1', name: 'My WS' };
        if (key === 'workspace:ws-2') return { workspaceId: 'ws-2', name: 'Other WS' };
        return null;
      });

      const req = new NextRequest('http://localhost/api/workspaces');
      const res = await GET(req);
      const data = await res.json();

      expect(data.workspaces).toHaveLength(1);
      expect(data.workspaces[0].id).toBe('ws-1');
    });

    it('returns all workspaces for ADMIN', async () => {
      mockGetUser.mockResolvedValueOnce({
        userId: 'admin-user',
        role: 'ADMIN',
        workspaceIds: [],
      });
      mockGetRawConfig.mockImplementation((key) => {
        if (key === 'workspace_index') return ['ws-1', 'ws-2'];
        if (key === 'workspace:ws-1') return { workspaceId: 'ws-1', name: 'WS 1' };
        if (key === 'workspace:ws-2') return { workspaceId: 'ws-2', name: 'WS 2' };
        return null;
      });

      const req = new NextRequest('http://localhost/api/workspaces');
      const res = await GET(req);
      const data = await res.json();

      expect(data.workspaces).toHaveLength(2);
    });
  });

  describe('POST', () => {
    it('denies invitation if no permission', async () => {
      mockHasPermission.mockResolvedValueOnce(false);
      const req = new NextRequest('http://localhost/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          action: 'invite',
          workspaceId: 'ws-1',
          memberId: 'user-2',
          role: 'collaborator',
        }),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe('Unauthorized workspace management');
    });

    it('allows invitation if permitted', async () => {
      mockHasPermission.mockResolvedValueOnce(true);
      const req = new NextRequest('http://localhost/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          action: 'invite',
          workspaceId: 'ws-1',
          memberId: 'user-2',
          role: 'collaborator',
        }),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(mockInviteMember).toHaveBeenCalled();
    });

    it('creates workspace and returns id', async () => {
      mockCreateWorkspace.mockResolvedValueOnce({ workspaceId: 'new-ws' });
      const req = new NextRequest('http://localhost/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Workspace',
          ownerId: 'test-user',
        }),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.id).toBe('new-ws');
    });
  });
});
