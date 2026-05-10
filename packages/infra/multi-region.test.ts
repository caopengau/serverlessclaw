import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createMultiRegionScaling } from './multi-region';

beforeAll(() => {
  (global as any).sst = {
    aws: {
      Queue: vi.fn().mockImplementation((name) => ({
        url: `https://sqs.ap-southeast-2.amazonaws.com/123456789012/${name}`,
      })),
    },
  };
});

describe('Multi-Region Scaling (VX-4.2)', () => {
  it('should create regional sync queues', () => {
    const mockCtx: any = {
      api: { url: 'https://api.example.com' },
    };

    const result = createMultiRegionScaling(mockCtx);

    expect(result.regionSyncQueue).toBeDefined();
    expect(result.regionSyncQueue.url).toContain('FrameworkRegionSyncQueue');
  });
});
