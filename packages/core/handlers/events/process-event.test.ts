import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processEventWithAgent } from './shared';
import { Agent } from '../../lib/agent';

vi.mock('../../lib/session/session-state', () => ({
  SessionStateManager: vi.fn().mockImplementation(function () {
    return {
      acquireProcessing: vi.fn().mockResolvedValue(true),
      releaseProcessing: vi.fn().mockResolvedValue(true),
    };
  }),
}));

vi.mock('../../lib/lock/lock-manager', () => ({
  LockManager: vi.fn().mockImplementation(function () {
    return {
      acquire: vi.fn().mockResolvedValue(true),
      release: vi.fn().mockResolvedValue(true),
    };
  }),
}));

vi.mock('../../lib/agent', () => {
  return {
    Agent: vi.fn().mockImplementation(function () {
      return {
        stream: vi.fn().mockImplementation((_userId, task) => {
          let text = 'hello';
          if (task.includes('yield invalid json')) {
            text = 'This is invalid JSON!';
          } else if (task.includes('yield valid json')) {
            text = JSON.stringify({
              status: 'SUCCESS',
              message: 'Task completed successfully',
              data: { key: 'value' },
            });
          }
          return (async function* () {
            yield { type: 'text', content: text };
          })();
        }),
      };
    }),
  };
});

vi.mock('../../lib/registry', () => ({
  AgentRegistry: {
    getAgentConfig: vi.fn().mockResolvedValue({ id: 'agent-1', name: 'Agent 1' }),
  },
}));

vi.mock('../../tools/index', () => ({
  getAgentTools: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../lib/utils/agent-helpers', () => ({
  getAgentContext: vi.fn().mockResolvedValue({ memory: {}, provider: {} }),
  isTaskPaused: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../lib/outbound', () => ({
  sendOutboundMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('processEventWithAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enforce json communication mode when initiatorId is provided', async () => {
    const userId = 'user-1';
    const agentId = 'agent-1';
    const task = 'do something';
    const options = {
      initiatorId: 'initiator-agent',
      traceId: 'trace-1',
      sessionId: 'sess-1',
      handlerTitle: 'TEST',
    };

    await processEventWithAgent(userId, agentId, task, options as any);

    const agentInstance = vi.mocked(Agent).mock.results[0].value;
    expect(agentInstance.stream).toHaveBeenCalledWith(
      userId,
      expect.stringContaining(task),
      expect.objectContaining({
        communicationMode: 'json',
      })
    );
  });

  it('should use text communication mode when initiatorId is missing', async () => {
    const userId = 'user-1';
    const agentId = 'agent-1';
    const task = 'do something';
    const options = {
      traceId: 'trace-1',
      sessionId: 'sess-1',
      handlerTitle: 'TEST',
    };

    await processEventWithAgent(userId, agentId, task, options as any);

    const agentInstance = vi.mocked(Agent).mock.results[0].value;
    expect(agentInstance.stream).toHaveBeenCalledWith(
      userId,
      expect.stringContaining(task),
      expect.objectContaining({
        communicationMode: 'text',
      })
    );
  });

  it('should intercept invalid JSON response when initiatorId is provided and return a schema-compliant FAILED signal', async () => {
    const userId = 'user-1';
    const agentId = 'agent-1';
    const task = 'yield invalid json';
    const options = {
      initiatorId: 'initiator-agent',
      traceId: 'trace-1',
      sessionId: 'sess-1',
      handlerTitle: 'TEST',
    };

    const result = await processEventWithAgent(userId, agentId, task, options as any);

    expect(result.responseText).toContain('JSON_SCHEMA_VALIDATION_ERROR');
    expect(result.parsedData).toEqual(
      expect.objectContaining({
        status: 'FAILED',
        message: expect.stringContaining('JSON_SCHEMA_VALIDATION_ERROR'),
      })
    );
  });

  it('should pass validation for valid JSON responses', async () => {
    const userId = 'user-1';
    const agentId = 'agent-1';
    const task = 'yield valid json';
    const options = {
      initiatorId: 'initiator-agent',
      traceId: 'trace-1',
      sessionId: 'sess-1',
      handlerTitle: 'TEST',
    };

    const result = await processEventWithAgent(userId, agentId, task, options as any);

    expect(result.parsedData).toEqual({
      status: 'SUCCESS',
      message: 'Task completed successfully',
      data: { key: 'value' },
    });
  });
});
