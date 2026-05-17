import { describe, it, expect, vi } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

const mockGetDistilledMemory = vi.fn().mockImplementation(async (id: string) => {
  if (id === 'PLAN#123') {
    return JSON.stringify({
      planId: '123',
      title: 'Evolution Test Plan',
      subTasks: [{ subTaskId: 'st-1', task: 'Task 1', status: 'PENDING' }],
    });
  }
  return null;
});

// Mock the core dependencies
vi.mock('@claw/core/lib/memory', () => {
  return {
    DynamoMemory: class {
      getDistilledMemory = mockGetDistilledMemory;
    },
  };
});

vi.mock('@claw/core/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Gap Plan API', () => {
  it('should fetch a specific plan by numeric ID', async () => {
    // The GET function returned by withApiHandler only takes ONE argument: req
    const req = {
      url: 'http://localhost/api/memory/gap/plan?gapId=GAP%23123&workspaceId=ws-123',
      method: 'GET',
    };

    const response = await GET(req as unknown as NextRequest);
    const data = await response.json();

    expect(data).toHaveProperty('plan');
    expect(data.plan).not.toBeNull();
    expect(data.plan.planId).toBe('123');

    const { DynamoMemory } = await import('@claw/core/lib/memory');
    expect(new DynamoMemory().getDistilledMemory).toHaveBeenCalledWith('PLAN#123', {
      workspaceId: 'ws-123',
    });
  });

  it('should return 400 if gapId is missing', async () => {
    const req = {
      url: 'http://localhost/api/memory/gap/plan',
      method: 'GET',
    };

    const response = await GET(req as unknown as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('gapId is required');
  });
});
