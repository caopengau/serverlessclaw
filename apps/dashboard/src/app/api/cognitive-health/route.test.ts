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
const mockGetMemoryByType = vi.fn();
vi.mock('@claw/core/lib/memory', () => ({
  DynamoMemory: class {},
}));
vi.mock('@claw/core/lib/memory/utils/query', () => ({
  getMemoryByType: mockGetMemoryByType,
}));

describe('/api/cognitive-health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
  });

  const makeReq = () => new NextRequest('http://localhost/api/cognitive-health?workspaceId=ws-1');

  it('should return cognitive health data when successful', async () => {
    const mockItems = [
      {
        userId: 'WS#ws-1#HEALTH#agent1',
        overallScore: 85,
        taskCompletionRate: 0.95,
        reasoningCoherence: 8.5,
        errorRate: 0.02,
        memoryFragmentation: 0.15,
        anomalies: [{ type: 'PERFORMANCE', severity: 'MEDIUM', message: 'High latency detected' }],
      },
    ];

    mockGetMemoryByType.mockResolvedValue(mockItems);

    const { GET } = await import('./route');
    const response = await GET(makeReq());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agents).toHaveLength(1);
    expect(mockGetMemoryByType).toHaveBeenCalledWith(
      expect.any(Object),
      'COGNITIVE_SNAPSHOT',
      100,
      'ws-1'
    );
  });

  it('should return 403 if user lacks permission', async () => {
    mockHasPermission.mockResolvedValue(false);
    mockGetMemoryByType.mockResolvedValue([]);

    const { GET } = await import('./route');
    const response = await GET(makeReq());
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Unauthorized workspace access');
  });

  it('should filter out items without required score field', async () => {
    const mockItems = [
      { userId: 'WS#ws-1#HEALTH#agent1' },
      {
        userId: 'WS#ws-1#HEALTH#agent2',
        overallScore: 70,
        taskCompletionRate: 0.8,
        reasoningCoherence: 7.0,
        errorRate: 0.1,
        memoryFragmentation: 0.2,
        anomalies: [],
      },
    ];

    mockGetMemoryByType.mockResolvedValue(mockItems);

    const { GET } = await import('./route');
    const response = await GET(makeReq());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agents).toHaveLength(1);
    expect(data.agents[0].agentId).toBe('agent2');
  });

  it('should return message when no health data exists', async () => {
    mockGetMemoryByType.mockResolvedValue([]);

    const { GET } = await import('./route');
    const response = await GET(makeReq());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.agents).toEqual([]);
    expect(data.message).toBe('No health data recorded');
  });

  it('should return 500 on error', async () => {
    mockGetMemoryByType.mockRejectedValue(new Error('DynamoDB error'));

    const { GET } = await import('./route');
    const response = await GET(makeReq());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch health data');
  });

  it('should strip HEALTH# prefix from agentId', async () => {
    const mockItems = [
      {
        userId: 'WS#ws-1#HEALTH#my-custom-agent-id',
        overallScore: 75,
        taskCompletionRate: 0.85,
        reasoningCoherence: 7.5,
        errorRate: 0.1,
        memoryFragmentation: 0.25,
        anomalies: [],
      },
    ];

    mockGetMemoryByType.mockResolvedValue(mockItems);

    const { GET } = await import('./route');
    const response = await GET(makeReq());
    const data = await response.json();

    expect(data.agents[0].agentId).toBe('my-custom-agent-id');
  });

  it('should preserve anomalies array', async () => {
    const mockItems = [
      {
        userId: 'WS#ws-1#HEALTH#agent1',
        overallScore: 60,
        taskCompletionRate: 0.7,
        reasoningCoherence: 6.0,
        errorRate: 0.15,
        memoryFragmentation: 0.3,
        anomalies: [{ type: 'MEMORY', severity: 'HIGH', message: 'Memory leak detected' }],
      },
    ];

    mockGetMemoryByType.mockResolvedValue(mockItems);

    const { GET } = await import('./route');
    const response = await GET(makeReq());
    const data = await response.json();

    expect(data.agents[0].anomalies).toHaveLength(1);
  });

  it('should have force-dynamic export', async () => {
    const routeModule = await import('./route');
    expect(routeModule.dynamic).toBe('force-dynamic');
  });
});
