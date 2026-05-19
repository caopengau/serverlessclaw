import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const mockUpdateGapStatus = vi.fn().mockResolvedValue({ success: true });
const mockHasPermission = vi.fn().mockResolvedValue(true);

// Mock the core memory module
vi.mock('@claw/core/lib/memory', () => {
  return {
    DynamoMemory: class {
      updateGapStatus = mockUpdateGapStatus;
    },
  };
});

// Mock the identity module
vi.mock('@claw/core/lib/session/identity', () => ({
  getIdentityManager: vi.fn().mockResolvedValue({
    hasPermission: mockHasPermission,
  }),
  Permission: {
    AGENT_UPDATE: 'AGENT_UPDATE',
  },
}));

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  getUserId: vi.fn().mockReturnValue('test-user'),
}));

// Mock @/lib/constants
vi.mock('@/lib/constants', () => ({
  HTTP_STATUS: {
    BAD_REQUEST: 400,
    INTERNAL_SERVER_ERROR: 500,
    OK: 200,
    FORBIDDEN: 403,
  },
}));

describe('Dashboard API: /api/memory/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if gapId or status is missing', async () => {
    const req = new NextRequest('http://localhost/api/memory/status', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Validation failed');
  });

  it('should return 400 if status is invalid', async () => {
    const req = new NextRequest('http://localhost/api/memory/status', {
      method: 'POST',
      body: JSON.stringify({ gapId: 'GAP#123', status: 'INVALID_STATUS' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Validation failed');
    expect(data.error).toContain('status');
  });

  it('should return 200 and call updateGapStatus if request is valid', async () => {
    const req = new NextRequest('http://localhost/api/memory/status?workspaceId=ws-123', {
      method: 'POST',
      body: JSON.stringify({ gapId: 'GAP#123', status: 'PLANNED' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    expect(mockUpdateGapStatus).toHaveBeenCalledWith('GAP#123', 'PLANNED', {
      workspaceId: 'ws-123',
    });
  });
});
