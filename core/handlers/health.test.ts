import { describe, it, expect, vi, beforeEach } from 'vitest';

const healthMocks = vi.hoisted(() => ({
  runDeepHealthCheck: vi.fn(),
}));

const memoryMocks = vi.hoisted(() => ({
  saveLKGHash: vi.fn(),
}));

vi.mock('../lib/health', () => ({
  runDeepHealthCheck: healthMocks.runDeepHealthCheck,
}));

vi.mock('../lib/memory', () => ({
  DynamoMemory: class {
    saveLKGHash = memoryMocks.saveLKGHash;
  },
}));

describe('Health Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GIT_HASH = 'test-hash';
  });

  it('should return 200 and save LKG if deep check passes', async () => {
    healthMocks.runDeepHealthCheck.mockResolvedValue({ ok: true });

    const { handler } = await import('./health');
    const result = await (handler as any)({}, {});

    expect(result.statusCode).toBe(200);
    expect(memoryMocks.saveLKGHash).toHaveBeenCalledWith('test-hash');
    const body = JSON.parse(result.body);
    expect(body.status).toBe('ok');
    expect(body.gitHash).toBe('test-hash');
  });

  it('should return 503 if deep check fails', async () => {
    healthMocks.runDeepHealthCheck.mockResolvedValue({ ok: false, details: 'DynamoDB error' });

    const { handler } = await import('./health');
    const result = await (handler as any)({}, {});

    expect(result.statusCode).toBe(503);
    const body = JSON.parse(result.body);
    expect(body.status).toBe('error');
    expect(body.message).toContain('Deep health check failed');
  });
});
