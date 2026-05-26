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

// Mock the core dependencies
const mockGetRollupRange = vi.fn();
vi.mock('@claw/core/lib/metrics/token-usage', () => ({
  TokenTracker: {
    getRollupRange: mockGetRollupRange,
  },
}));

vi.mock('@claw/core/lib/registry/AgentRegistry', () => ({
  AgentRegistry: {
    getAllConfigs: vi.fn().mockResolvedValue({ agent1: {}, agent2: {} }),
  },
}));

vi.mock('@claw/core/lib/registry/config', () => ({
  ConfigManager: {
    getTypedConfig: vi.fn().mockResolvedValue(1000000), // budget: 1M tokens
  },
}));

// Use a partial mock for CONFIG_DEFAULTS to avoid breaking system constants
vi.mock('@claw/core/lib/config/config-defaults', async (importActual) => {
  const actual = await importActual<typeof import('@claw/core/lib/config/config-defaults')>();
  return {
    ...actual,
    CONFIG_DEFAULTS: {
      ...actual.CONFIG_DEFAULTS,
      GLOBAL_TOKEN_BUDGET: { code: 'global_token_budget' },
    },
  };
});

describe('Burn-Rate API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
  });

  it('should calculate daily burn rate against budget with workspace scoping', async () => {
    const now = Date.now();
    mockGetRollupRange.mockImplementation((agentId) => {
      if (agentId === 'agent1') {
        return Promise.resolve([
          {
            totalInputTokens: 1000,
            totalOutputTokens: 500,
            invocationCount: 10,
            timestamp: now,
          },
        ]);
      } else if (agentId === 'agent2') {
        return Promise.resolve([
          {
            totalInputTokens: 2000,
            totalOutputTokens: 1000,
            invocationCount: 20,
            timestamp: now,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const req = new NextRequest('http://localhost/api/system/burn-rate?workspaceId=ws-1');
    const response = await GET(req);
    const data = await response.json();

    expect(data).toHaveProperty('totalTokens');
    expect(data).toHaveProperty('burnRatePerHour');
    expect(data.totalTokens).toBe(4500); // (1000+500) + (2000+1000)
    expect(data.usageRatio).toBe(4500 / 1000000);
    expect(mockGetRollupRange).toHaveBeenCalledWith('agent1', 1, { workspaceId: 'ws-1' });
    expect(mockGetRollupRange).toHaveBeenCalledWith('agent2', 1, { workspaceId: 'ws-1' });
  });

  it('should return 403 if user lacks permission', async () => {
    mockHasPermission.mockResolvedValue(false);
    const req = new NextRequest('http://localhost/api/system/burn-rate?workspaceId=ws-1');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Unauthorized workspace access');
  });
});
