import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './researcher';
import { initAgent } from '../lib/utils/agent-helpers';

vi.mock('../lib/utils/agent-helpers', () => ({
  validateEventPayload: vi.fn().mockImplementation((event) => event.detail),
  buildProcessOptions: vi.fn().mockImplementation((opts) => opts),
  initAgent: vi.fn().mockImplementation(async () => {
    return {
      memory: {
        getDistilledMemory: vi.fn().mockResolvedValue(null),
        searchInsights: vi.fn().mockResolvedValue({ items: [] }),
        addMemory: vi.fn().mockResolvedValue(true),
      },
      agent: {
        process: vi.fn().mockResolvedValue({ responseText: 'mock research output' }),
      },
    };
  }),
}));

vi.mock('../lib/utils/agent-helpers/event-emitter', () => ({
  emitTaskEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/agent/decomposer', () => ({
  decomposePlan: vi.fn().mockResolvedValue({ wasDecomposed: false, subTasks: [] }),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Researcher Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process research task and return output', async () => {
    const event = {
      detail: {
        userId: 'user-1',
        task: 'research something',
        metadata: {},
        traceId: 'trace-1',
        sessionId: 'sess-1',
      },
      source: 'agent.researcher',
    } as any;

    const result = await handler(event, {} as any);

    expect(result).toBe('mock research output');
  });

  it('should fetch target technical specifications from memory when gapIds are present', async () => {
    const mockGetDistilledMemory = vi.fn().mockResolvedValue(
      JSON.stringify({
        spec: 'EARS specification body here',
      })
    );

    vi.mocked(initAgent).mockImplementationOnce(async () => {
      return {
        memory: {
          getDistilledMemory: mockGetDistilledMemory,
          searchInsights: vi.fn().mockResolvedValue({ items: [] }),
          addMemory: vi.fn().mockResolvedValue(true),
        },
        agent: {
          process: vi.fn().mockResolvedValue({ responseText: 'mock spec-guided output' }),
        },
      } as any;
    });

    const event = {
      detail: {
        userId: 'user-1',
        task: 'research database indexing',
        metadata: {
          gapIds: ['gap-123'],
        },
        traceId: 'trace-1',
        sessionId: 'sess-1',
      },
      source: 'agent.researcher',
    } as any;

    const result = await handler(event, {} as any);

    expect(result).toBe('mock spec-guided output');
    expect(mockGetDistilledMemory).toHaveBeenCalledWith('PLAN#gap-123');
  });
});
