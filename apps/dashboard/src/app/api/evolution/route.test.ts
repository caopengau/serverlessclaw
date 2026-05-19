import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PATCH } from './route';

const mockQueryItems = vi.fn().mockResolvedValue([]);
const mockHasPermission = vi.fn().mockResolvedValue(true);
const mockUpdateStatus = vi.fn().mockResolvedValue(undefined);

// Mock the core memory module
vi.mock('@claw/core/lib/memory/base', () => ({
  BaseMemoryProvider: class {
    queryItems = mockQueryItems;
  },
}));

// Mock the identity module
vi.mock('@claw/core/lib/session/identity', () => ({
  getIdentityManager: vi.fn().mockResolvedValue({
    hasPermission: mockHasPermission,
  }),
  Permission: {
    EVOLUTION_VIEW: 'EVOLUTION_VIEW',
    EVOLUTION_APPROVE: 'EVOLUTION_APPROVE',
  },
}));

// Mock evolution scheduler
vi.mock('@claw/core/lib/safety/evolution-scheduler', () => ({
  EvolutionScheduler: class {
    updateStatus = mockUpdateStatus;
  },
}));

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  getUserId: vi.fn().mockReturnValue('test-user'),
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
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

// Mock @claw/core/lib/constants
vi.mock('@claw/core/lib/constants', () => ({
  HTTP_STATUS: {
    BAD_REQUEST: 400,
    INTERNAL_SERVER_ERROR: 500,
    OK: 200,
    FORBIDDEN: 403,
  },
}));

describe('Evolution API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 403 if permission is denied', async () => {
      mockHasPermission.mockResolvedValueOnce(false);
      const req = new NextRequest('http://localhost/api/evolution?workspaceId=ws-123');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe('Unauthorized workspace access');
    });

    it('returns 200 and items if permitted', async () => {
      mockQueryItems.mockResolvedValueOnce([{ id: 'ev-1', status: 'pending' }]);
      const req = new NextRequest('http://localhost/api/evolution?workspaceId=ws-123');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].id).toBe('ev-1');
      expect(mockHasPermission).toHaveBeenCalledWith('test-user', 'EVOLUTION_VIEW', 'ws-123');
    });
  });

  describe('PATCH', () => {
    it('returns 400 for invalid payload', async () => {
      const req = new NextRequest('http://localhost/api/evolution', {
        method: 'PATCH',
        body: JSON.stringify({ actionId: 'ev-1' }), // Missing status
      });
      const res = await PATCH(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid payload');
    });

    it('returns 403 if permission is denied', async () => {
      mockHasPermission.mockResolvedValueOnce(false);
      const req = new NextRequest('http://localhost/api/evolution', {
        method: 'PATCH',
        body: JSON.stringify({ actionId: 'ev-1', status: 'approved', workspaceId: 'ws-123' }),
      });
      const res = await PATCH(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe('Unauthorized workspace access');
    });

    it('calls updateStatus and returns success if permitted', async () => {
      const req = new NextRequest('http://localhost/api/evolution', {
        method: 'PATCH',
        body: JSON.stringify({ actionId: 'ev-1', status: 'approved', workspaceId: 'ws-123' }),
      });
      const res = await PATCH(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpdateStatus).toHaveBeenCalledWith('ev-1', 'approved', 'ws-123');
      expect(mockHasPermission).toHaveBeenCalledWith('test-user', 'EVOLUTION_APPROVE', 'ws-123');
    });
  });
});
