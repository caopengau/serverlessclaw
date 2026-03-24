import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('sst', () => ({
  Resource: {
    DashboardPassword: { value: 'test-password-123' },
  },
}));

vi.mock('@/lib/constants', () => ({
  AUTH: {
    COOKIE_NAME: 'claw_auth_session',
    COOKIE_VALUE: 'authenticated',
    COOKIE_MAX_AGE: 604800,
    ERROR_INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    ERROR_SYSTEM_FAILURE: 'SYSTEM_FAILURE',
  },
  HTTP_STATUS: { UNAUTHORIZED: 401, INTERNAL_SERVER_ERROR: 500 },
}));

describe('Auth Login API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and sets cookie on valid password', async () => {
    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'test-password-123' }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(res.cookies.get('claw_auth_session')).toBeDefined();
  });

  it('returns 401 on invalid password', async () => {
    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'wrong-password' }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 on missing password', async () => {
    const { POST } = await import('./route');
    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('INVALID_CREDENTIALS');
  });
});
