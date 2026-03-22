import { vi, describe, it, expect, beforeEach } from 'vitest';

// 1. Mock 'sst'
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

// Mock ConfigManager
vi.mock('../lib/registry/config', () => ({
  ConfigManager: {
    getRawConfig: vi.fn().mockImplementation((key) => {
      if (key === 'clarification_timeout_ms') return 300000;
      if (key === 'clarification_max_retries') return 1;
      return null;
    }),
  },
}));

// Mock DynamoMemory
const { mockSaveClarificationRequest, mockGetClarificationRequest, mockUpdateClarificationStatus } =
  vi.hoisted(() => ({
    mockSaveClarificationRequest: vi.fn(),
    mockGetClarificationRequest: vi.fn(),
    mockUpdateClarificationStatus: vi.fn(),
  }));

vi.mock('../lib/memory', () => {
  return {
    DynamoMemory: vi.fn().mockImplementation(function () {
      return {
        saveClarificationRequest: mockSaveClarificationRequest,
        getClarificationRequest: mockGetClarificationRequest,
        updateClarificationStatus: mockUpdateClarificationStatus,
      };
    }),
  };
});

// Mock DynamicScheduler
vi.mock('../lib/scheduler', () => ({
  DynamicScheduler: {
    scheduleOneShotTimeout: vi.fn().mockResolvedValue({}),
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

// Mock outbound
vi.mock('../lib/outbound', () => ({
  sendOutboundMessage: vi.fn().mockResolvedValue({}),
}));

import { handleClarificationRequest } from './events/clarification-handler';
import { handleClarificationTimeout } from './events/clarification-timeout-handler';
import { EventType } from '../lib/types/agent';

describe('Clarification Resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SCHEDULER_ROLE_ARN = 'test-role';
    process.env.EVENT_HANDLER_ARN = 'test-handler';
  });

  describe('handleClarificationRequest', () => {
    it('should save state and schedule timeout', async () => {
      const eventDetail = {
        userId: 'user-1',
        agentId: 'coder',
        question: 'Tabs or Spaces?',
        traceId: 'trace-1',
        initiatorId: 'planner',
        originalTask: 'Work',
      };

      await handleClarificationRequest(eventDetail);

      expect(mockSaveClarificationRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'CLARIFICATION#trace-1#coder',
          status: 'pending',
          retryCount: 0,
        })
      );

      const { DynamicScheduler } = await import('../lib/scheduler');
      expect(DynamicScheduler.scheduleOneShotTimeout).toHaveBeenCalledWith(
        expect.stringContaining('clarify-trace-1-coder'),
        expect.objectContaining({
          traceId: 'trace-1',
          retryCount: 0,
        }),
        expect.any(Number),
        EventType.CLARIFICATION_TIMEOUT
      );
    });
  });

  describe('handleClarificationTimeout', () => {
    it('should retry if retryCount < maxRetries', async () => {
      mockGetClarificationRequest.mockResolvedValue({
        status: 'pending',
        retryCount: 0,
        question: 'Tabs or Spaces?',
      });

      const eventDetail = {
        userId: 'user-1',
        agentId: 'coder',
        traceId: 'trace-1',
        question: 'Tabs or Spaces?',
        retryCount: 0,
      };

      await handleClarificationTimeout(eventDetail as any);

      expect(mockUpdateClarificationStatus).toHaveBeenCalledWith('trace-1', 'coder', 'pending');

      const { emitEvent } = await import('../lib/utils/bus');
      expect(emitEvent).toHaveBeenCalledWith(
        'events.handler',
        EventType.CLARIFICATION_REQUEST,
        expect.objectContaining({
          retryCount: 1,
          question: expect.stringContaining('[RETRY 1/1]'),
        }),
        expect.any(Object)
      );
    });

    it('should escalate if retryCount >= maxRetries', async () => {
      mockGetClarificationRequest.mockResolvedValue({
        status: 'pending',
        retryCount: 1,
        question: 'Tabs or Spaces?',
      });

      const eventDetail = {
        userId: 'user-1',
        agentId: 'coder',
        traceId: 'trace-1',
        question: 'Tabs or Spaces?',
        retryCount: 1,
        originalTask: 'Work',
      };

      await handleClarificationTimeout(eventDetail as any);

      expect(mockUpdateClarificationStatus).toHaveBeenCalledWith('trace-1', 'coder', 'timed_out');

      const { emitEvent } = await import('../lib/utils/bus');
      expect(emitEvent).toHaveBeenCalledWith(
        'events.handler',
        EventType.TASK_FAILED,
        expect.objectContaining({
          error: expect.stringContaining('timed out after 1 retry attempts'),
        }),
        expect.any(Object)
      );

      const { sendOutboundMessage } = await import('../lib/outbound');
      expect(sendOutboundMessage).toHaveBeenCalledWith(
        expect.any(String),
        'user-1',
        expect.stringContaining('Clarification Timeout'),
        undefined,
        undefined,
        'SuperClaw',
        undefined
      );
    });

    it('should do nothing if already answered', async () => {
      mockGetClarificationRequest.mockResolvedValue({
        status: 'answered',
      });

      const eventDetail = {
        traceId: 'trace-1',
        agentId: 'coder',
      };

      await handleClarificationTimeout(eventDetail as any);

      const { emitEvent } = await import('../lib/utils/bus');
      expect(emitEvent).not.toHaveBeenCalled();
    });
  });
});
