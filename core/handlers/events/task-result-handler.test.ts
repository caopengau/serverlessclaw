import { vi, describe, it, expect, beforeEach } from 'vitest';

// 1. Mock 'sst'
vi.mock('sst', () => ({
  Resource: new Proxy(
    {},
    {
      get: (_target, prop) => {
        return {
          name: `test-${String(prop).toLowerCase()}`,
          value: 'test-value',
        };
      },
    }
  ),
}));

// 2. Mock AgentBus / EventBridge
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({}),
}));

vi.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: vi.fn().mockImplementation(function () {
    return { send: mockSend };
  }),
  PutEventsCommand: vi.fn().mockImplementation(function (this: any, args) {
    this.input = args;
    return this;
  }),
}));

// 3. Mock Outbound
vi.mock('../../lib/outbound', () => ({
  sendOutboundMessage: vi.fn().mockResolvedValue({}),
}));

// 4. Mock Logger
vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// 5. Mock Registry / Config
vi.mock('../../lib/registry/config', () => ({
  ConfigManager: {
    getRawConfig: vi.fn().mockResolvedValue('50'),
  },
}));

// 6. Import code to test
import { handleTaskResult } from './task-result-handler';
import { EventType } from '../../lib/types/agent';

describe('task-result-handler (Direct Voice Flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include USER_ALREADY_NOTIFIED marker in continuation task when userNotified is true', async () => {
    const eventDetail = {
      userId: 'user-123',
      agentId: 'planner',
      task: 'Analyze architecture',
      response: 'The architecture is serverless...',
      initiatorId: 'superclaw',
      depth: 1,
      sessionId: 'session-456',
      userNotified: true,
    };

    await handleTaskResult(eventDetail, EventType.TASK_COMPLETED);

    // Verify EventBridge emission (wakeupInitiator)
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Entries: [
            expect.objectContaining({
              DetailType: EventType.CONTINUATION_TASK,
              Detail: expect.stringContaining('(USER_ALREADY_NOTIFIED: true)'),
            }),
          ],
        }),
      })
    );
  });

  it('should NOT include USER_ALREADY_NOTIFIED marker when userNotified is false or missing', async () => {
    const eventDetail = {
      userId: 'user-123',
      agentId: 'coder',
      task: 'Fix bug',
      response: 'Bug fixed',
      initiatorId: 'superclaw',
      depth: 1,
      sessionId: 'session-456',
      // userNotified missing
    };

    await handleTaskResult(eventDetail, EventType.TASK_COMPLETED);

    // Verify marker is ABSENT
    const callDetail = JSON.parse(mockSend.mock.calls[0][0].input.Entries[0].Detail);
    expect(callDetail.task).not.toContain('(USER_ALREADY_NOTIFIED: true)');
    expect(callDetail.task).toContain('DELEGATED_TASK_RESULT');
  });

  it('should propagate userNotified flag through task failure events', async () => {
    const eventDetail = {
      userId: 'user-123',
      agentId: 'planner',
      task: 'Complex audit',
      error: 'Simulated failure',
      initiatorId: 'superclaw',
      depth: 1,
      userNotified: true,
    };

    await handleTaskResult(eventDetail, EventType.TASK_FAILED);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Entries: [
            expect.objectContaining({
              Detail: expect.stringContaining('(USER_ALREADY_NOTIFIED: true)'),
            }),
          ],
        }),
      })
    );
  });
});

describe('task-result-handler (Bug 4 — duplicate event dedup)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip processing when the same event id is received twice', async () => {
    const eventDetail = {
      id: 'evt-dedup-001',
      userId: 'user-123',
      agentId: 'coder',
      task: 'Implement feature',
      response: 'Feature implemented',
      initiatorId: 'superclaw',
      depth: 1,
      sessionId: 'session-1',
    };

    // First call — should process
    await handleTaskResult(eventDetail, EventType.TASK_COMPLETED);
    const firstCallCount = mockSend.mock.calls.length;
    expect(firstCallCount).toBeGreaterThan(0);

    // Second call with same id — should be skipped
    await handleTaskResult(eventDetail, EventType.TASK_COMPLETED);
    expect(mockSend.mock.calls.length).toBe(firstCallCount); // no new calls
  });

  it('should process events with different ids', async () => {
    const event1 = {
      id: 'evt-dedup-002',
      userId: 'user-123',
      agentId: 'coder',
      task: 'Task A',
      response: 'Done A',
      initiatorId: 'superclaw',
      depth: 1,
    };
    const event2 = {
      id: 'evt-dedup-003',
      userId: 'user-123',
      agentId: 'coder',
      task: 'Task B',
      response: 'Done B',
      initiatorId: 'superclaw',
      depth: 1,
    };

    await handleTaskResult(event1, EventType.TASK_COMPLETED);
    const afterFirst = mockSend.mock.calls.length;

    await handleTaskResult(event2, EventType.TASK_COMPLETED);
    expect(mockSend.mock.calls.length).toBeGreaterThan(afterFirst);
  });

  it('should deduplicate failure events with the same id', async () => {
    const eventDetail = {
      id: 'evt-dedup-004',
      userId: 'user-123',
      agentId: 'qa',
      task: 'Run tests',
      error: 'Test failure',
      initiatorId: 'superclaw',
      depth: 1,
    };

    await handleTaskResult(eventDetail, EventType.TASK_FAILED);
    const afterFirst = mockSend.mock.calls.length;

    // Duplicate failure
    await handleTaskResult(eventDetail, EventType.TASK_FAILED);
    expect(mockSend.mock.calls.length).toBe(afterFirst);
  });

  it('should still process events that have no id field', async () => {
    const eventDetail = {
      userId: 'user-123',
      agentId: 'monitor',
      task: 'Health check',
      response: 'All good',
      initiatorId: 'superclaw',
      depth: 1,
    };

    // Both calls should process (no id to dedup on)
    await handleTaskResult(eventDetail, EventType.TASK_COMPLETED);
    const afterFirst = mockSend.mock.calls.length;

    await handleTaskResult(eventDetail, EventType.TASK_COMPLETED);
    expect(mockSend.mock.calls.length).toBeGreaterThan(afterFirst);
  });
});
