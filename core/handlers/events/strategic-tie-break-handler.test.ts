import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleStrategicTieBreak } from './strategic-tie-break-handler';
import { emitEvent } from '../../lib/utils/bus';
import { EventType } from '../../lib/types/agent';

vi.mock('../../lib/utils/bus', () => ({
  emitEvent: vi.fn(),
  EventPriority: { HIGH: 'high' },
}));

vi.mock('../../lib/outbound', () => ({
  sendOutboundMessage: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('handleStrategicTieBreak', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('repro: generates invalid event type for hyphenated agent IDs', async () => {
    const eventDetail = {
      userId: 'user-1',
      agentId: 'strategic-planner',
      task: 'Plan the evolution',
      originalTask: 'Original plan',
      traceId: 'trace-123',
      initiatorId: 'initiator-1',
      sessionId: 'session-1',
      depth: 1,
    };

    await handleStrategicTieBreak(eventDetail);

    // FIX VERIFIED: Now generates 'strategic_planner_task' (valid)
    expect(emitEvent).toHaveBeenCalledWith(
      expect.anything(),
      'strategic_planner_task',
      expect.objectContaining({
        agentId: 'strategic-planner',
      }),
      expect.anything()
    );
  });

  it('correctly handles high-risk tasks by failing them', async () => {
    const eventDetail = {
      userId: 'user-1',
      agentId: 'coder',
      task: 'Delete everything',
      originalTask: 'rm -rf /',
      traceId: 'trace-456',
      initiatorId: 'initiator-2',
      sessionId: 'session-2',
      depth: 2,
    };

    await handleStrategicTieBreak(eventDetail);

    expect(emitEvent).toHaveBeenCalledWith(
      expect.anything(),
      EventType.TASK_FAILED,
      expect.objectContaining({
        strategicDecision: 'DEFERRED',
      }),
      expect.anything()
    );
  });
});
