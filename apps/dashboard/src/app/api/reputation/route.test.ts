import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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

// Mock the core memory module
const mockListByPrefix = vi.fn();
vi.mock('@claw/core/lib/memory', () => ({
  DynamoMemory: class {
    listByPrefix = mockListByPrefix;
  },
}));

describe('/api/reputation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
  });

  const makeReq = () => new NextRequest('http://localhost/api/reputation?workspaceId=ws-1');

  it('should return reputation data when successful with workspace scoping', async () => {
    const mockItems = [
      {
        userId: 'WS#ws-1#REPUTATION#agent1',
        tasksCompleted: 10,
        tasksFailed: 1,
        successRate: 0.9,
        avgLatencyMs: 500,
        lastActive: 1700000000000,
      },
    ];

    mockListByPrefix.mockResolvedValue(mockItems);

    const { GET } = await import('./route');
    const response = await GET(makeReq());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reputation).toHaveLength(1);
    expect(data.reputation[0].agentId).toBe('agent1');
    expect(mockListByPrefix).toHaveBeenCalledWith('WS#ws-1#REPUTATION#');
  });

  it('should return 403 if user lacks permission', async () => {
    mockHasPermission.mockResolvedValue(false);
    mockListByPrefix.mockResolvedValue([]);

    const { GET } = await import('./route');
    const response = await GET(makeReq());
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Unauthorized workspace access');
  });

  it('should return 500 on error', async () => {
    mockListByPrefix.mockRejectedValue(new Error('DynamoDB error'));

    const { GET } = await import('./route');
    const response = await GET(makeReq());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch reputation data');
  });
});
