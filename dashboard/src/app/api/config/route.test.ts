import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('sst', () => ({
  Resource: {
    App: { name: 'test-app', stage: 'test-stage' },
    RealtimeBus: { endpoint: 'wss://example.com/mqtt' },
  },
}));

describe('Config API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns realtime URL with wss:// prefix', async () => {
    const { GET } = await import('./route');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await GET({} as any);
    const data = await res.json();


    expect(res.status).toBe(200);
    expect(data.realtime.url).toBe('wss://example.com/mqtt');
  });

  it('converts https:// endpoint to wss://', async () => {
    vi.resetModules();
    vi.doMock('sst', () => ({
      Resource: {
        App: { name: 'test-app', stage: 'test-stage' },
        RealtimeBus: { endpoint: 'https://example.com/mqtt' },
      },
    }));

    const { GET } = await import('./route');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await GET({} as any);
    const data = await res.json();


    expect(data.realtime.url).toBe('wss://example.com/mqtt');
  });

  it('prepends wss:// to bare domain endpoint', async () => {
    vi.resetModules();
    vi.doMock('sst', () => ({
      Resource: {
        App: { name: 'test-app', stage: 'test-stage' },
        RealtimeBus: { endpoint: 'example.com/mqtt' },
      },
    }));

    const { GET } = await import('./route');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await GET({} as any);
    const data = await res.json();


    expect(data.realtime.url).toBe('wss://example.com/mqtt');
  });
});
