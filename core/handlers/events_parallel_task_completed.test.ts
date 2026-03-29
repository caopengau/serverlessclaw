import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock 'sst'
vi.mock('sst', () => ({
  Resource: new Proxy(
    {},
    {
      get: (_target, prop) => {
        return {
          name: `test-${String(prop).toLowerCase()}`,
        };
      },
    }
  ),
}));

// Mock logger
vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock bus
vi.mock('../lib/utils/bus', () => ({
  emitEvent: vi.fn().mockResolvedValue({}),
  EventPriority: {
    HIGH: 'high',
    CRITICAL: 'critical',
  },
}));

import { handleParallelTaskCompleted } from './events/parallel-task-completed-handler';
import { EventType } from '../lib/types/agent';

describe('handleParallelTaskCompleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should wake up initiator with success summary when all tasks succeed', async () => {
    const eventDetail = {
      userId: 'user-1',
      sessionId: 'session-1',
      traceId: 'trace-1',
      initiatorId: 'strategic-planner',
      overallStatus: 'success',
      results: [
        { taskId: 't1', agentId: 'coder', status: 'success', result: 'Fixed bug in auth' },
        { taskId: 't2', agentId: 'qa', status: 'success', result: 'All tests pass' },
      ],
      taskCount: 2,
      completedCount: 2,
      elapsedMs: 5000,
    };

    await handleParallelTaskCompleted(eventDetail);

    const { emitEvent } = await import('../lib/utils/bus');
    expect(emitEvent).toHaveBeenCalledTimes(1);
    expect(emitEvent).toHaveBeenCalledWith(
      'events.handler',
      EventType.CONTINUATION_TASK,
      expect.objectContaining({
        userId: 'user-1',
        agentId: 'strategic-planner',
        traceId: 'trace-1',
        sessionId: 'session-1',
        depth: 2,
      })
    );

    // Verify the task message contains success indicators
    const callArgs = (emitEvent as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const taskContent = typeof callArgs.task === 'string' ? callArgs.task : '';
    expect(taskContent).toContain('✅');
    expect(taskContent).toContain('SUCCESS');
    expect(taskContent).toContain('coder');
    expect(taskContent).toContain('qa');
    expect(taskContent).toContain('Fixed bug in auth');
  });

  it('should wake up initiator with partial summary when some tasks fail', async () => {
    const eventDetail = {
      userId: 'user-1',
      traceId: 'trace-2',
      initiatorId: 'strategic-planner',
      overallStatus: 'partial',
      results: [
        { taskId: 't1', agentId: 'coder', status: 'success', result: 'Done' },
        { taskId: 't2', agentId: 'qa', status: 'failed', error: 'Test timeout' },
      ],
      taskCount: 2,
      completedCount: 2,
    };

    await handleParallelTaskCompleted(eventDetail);

    const { emitEvent } = await import('../lib/utils/bus');
    const callArgs = (emitEvent as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(callArgs.task).toContain('⚠️');
    expect(callArgs.task).toContain('PARTIAL');
    expect(callArgs.task).toContain('1 succeeded');
    expect(callArgs.task).toContain('1 failed');
  });

  it('should wake up initiator with failed summary when all tasks fail', async () => {
    const eventDetail = {
      userId: 'user-1',
      traceId: 'trace-3',
      initiatorId: 'strategic-planner',
      overallStatus: 'failed',
      results: [
        { taskId: 't1', agentId: 'coder', status: 'failed', error: 'OOM' },
        { taskId: 't2', agentId: 'qa', status: 'timeout', error: null },
      ],
      taskCount: 2,
      completedCount: 2,
    };

    await handleParallelTaskCompleted(eventDetail);

    const { emitEvent } = await import('../lib/utils/bus');
    const callArgs = (emitEvent as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(callArgs.task).toContain('❌');
    expect(callArgs.task).toContain('FAILED');
    expect(callArgs.task).toContain('1 failed');
    expect(callArgs.task).toContain('1 timed out');
  });

  it('should not emit event when initiatorId is missing', async () => {
    const eventDetail = {
      userId: 'user-1',
      traceId: 'trace-4',
      overallStatus: 'success',
      results: [{ taskId: 't1', agentId: 'coder', status: 'success', result: 'Done' }],
      taskCount: 1,
      completedCount: 1,
    };

    await handleParallelTaskCompleted(eventDetail);

    const { emitEvent } = await import('../lib/utils/bus');
    expect(emitEvent).not.toHaveBeenCalled();

    const { logger } = await import('../lib/logger');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('no initiatorId provided'));
  });

  it('should truncate long results to 200 characters', async () => {
    const longResult = 'A'.repeat(500);
    const eventDetail = {
      userId: 'user-1',
      traceId: 'trace-5',
      initiatorId: 'strategic-planner',
      overallStatus: 'success',
      results: [{ taskId: 't1', agentId: 'coder', status: 'success', result: longResult }],
      taskCount: 1,
      completedCount: 1,
    };

    await handleParallelTaskCompleted(eventDetail);

    const { emitEvent } = await import('../lib/utils/bus');
    const callArgs = (emitEvent as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const taskContent = typeof callArgs.task === 'string' ? callArgs.task : '';
    // The truncated result should be at most 200 chars in the task summary
    expect(taskContent).toContain('A'.repeat(200));
    expect(taskContent).not.toContain('A'.repeat(201));
  });

  it('should handle empty results array', async () => {
    const eventDetail = {
      userId: 'user-1',
      traceId: 'trace-6',
      initiatorId: 'strategic-planner',
      overallStatus: 'failed',
      results: [],
      taskCount: 0,
      completedCount: 0,
    };

    await handleParallelTaskCompleted(eventDetail);

    const { emitEvent } = await import('../lib/utils/bus');
    expect(emitEvent).toHaveBeenCalledTimes(1);
    const callArgs = (emitEvent as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const taskContent = typeof callArgs.task === 'string' ? callArgs.task : '';
    expect(taskContent).toContain('0/0 completed');
  });
});
