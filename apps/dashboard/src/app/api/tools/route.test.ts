import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetToolUsage = vi.fn();
const mockGetAllTools = vi.fn();

vi.mock('@/lib/tool-utils', () => ({
  getToolUsage: mockGetToolUsage,
  getAllTools: mockGetAllTools,
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
    AGENT_VIEW: 'agent:view',
  },
}));

vi.mock('@claw/core/lib/constants', () => ({
  HTTP_STATUS: { INTERNAL_SERVER_ERROR: 500, FORBIDDEN: 403 },
}));

describe('Tools API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
  });

  const makeReq = (url: string = 'http://localhost/api/tools') => new NextRequest(url);

  it('returns tools list on success with workspace scoping', async () => {
    const tools = [
      {
        name: 'recallKnowledge',
        description: 'Recall knowledge',
        usage: { count: 5, lastUsed: 12345 },
        isExternal: false,
      },
    ];
    mockGetToolUsage.mockResolvedValue({});
    mockGetAllTools.mockResolvedValue(tools);

    const { GET } = await import('./route');
    const req = makeReq('http://localhost/api/tools?workspaceId=ws-1');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.tools).toEqual(tools);
    expect(mockGetToolUsage).toHaveBeenCalledWith({ workspaceId: 'ws-1' });
  });

  it('returns 403 if user lacks permission', async () => {
    mockHasPermission.mockResolvedValue(false);
    const { GET } = await import('./route');
    const req = makeReq('http://localhost/api/tools?workspaceId=ws-1');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe('Unauthorized workspace access');
  });

  it('passes refresh=true to getAllTools', async () => {
    mockGetToolUsage.mockResolvedValue({});
    mockGetAllTools.mockResolvedValue([]);

    const { GET } = await import('./route');
    const req = makeReq('http://localhost/api/tools?refresh=true&workspaceId=ws-1');
    await GET(req);

    expect(mockGetAllTools).toHaveBeenCalledWith({}, { forceRefresh: true, workspaceId: 'ws-1' });
  });

  it('returns 500 on error', async () => {
    mockGetToolUsage.mockRejectedValue(new Error('DynamoDB error'));

    const { GET } = await import('./route');
    const req = makeReq();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to fetch tools');
  });
});
