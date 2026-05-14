import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
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

// Mock the core dependencies as a class for the constructor
const mockListByPrefix = vi.fn().mockResolvedValue([
  { timestamp: Date.now() - 3600000, outcome: 'failure' },
  { timestamp: Date.now() - 1800000, outcome: 'success' },
]);

vi.mock('@claw/core/lib/memory', () => {
  return {
    DynamoMemory: class {
      listByPrefix = mockListByPrefix;
    },
  };
});

const mockGetCircuitBreaker = vi.fn().mockReturnValue({
  getState: vi.fn().mockResolvedValue({
    state: 'closed',
    lastFailureTime: 123456789,
    failures: [],
    emergencyDeployCount: 0,
  }),
});

vi.mock('@claw/core/lib/safety/circuit-breaker', () => {
  return {
    getCircuitBreaker: mockGetCircuitBreaker,
  };
});

describe('Resilience Metrics API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
  });

  it('should return aggregated resilience metrics with workspace scoping', async () => {
    const req = new NextRequest('http://localhost/api/resilience/metrics?workspaceId=ws-1');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('healthScore');
    expect(data).toHaveProperty('circuitBreaker');
    expect(data.circuitBreaker.state).toBe('closed');

    // Verify workspace scoping
    expect(mockGetCircuitBreaker).toHaveBeenCalledWith('deploy', 'ws-1');
    expect(mockListByPrefix).toHaveBeenCalledWith('WS#ws-1#DISTILLED#RECOVERY');
  });

  it('should return 403 if user lacks permission', async () => {
    mockHasPermission.mockResolvedValue(false);
    const req = new NextRequest('http://localhost/api/resilience/metrics?workspaceId=ws-1');
    const response = await GET(req);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized workspace access');
  });
});
