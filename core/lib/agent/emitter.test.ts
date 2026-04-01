/**
 * @module AgentEmitter Tests
 * @description Tests for reflection emission, continuation emission,
 * and real-time chunk publishing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSend, mockPublishToRealtime, mockExtractBaseUserId } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockPublishToRealtime: vi.fn(),
  mockExtractBaseUserId: vi.fn((id: string) => id),
}));

import { AgentEmitter } from './emitter';
import { MessageRole } from '../types/index';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@aws-sdk/client-eventbridge', () => {
  class MockEventBridgeClient {
    send = mockSend;
  }
  return {
    EventBridgeClient: MockEventBridgeClient,
    PutEventsCommand: class {
      constructor(public input: any) {}
    },
  };
});

vi.mock('sst', () => ({
  Resource: { AgentBus: { name: 'test-bus' } },
}));

vi.mock('../registry', () => ({
  AgentRegistry: { getRawConfig: vi.fn() },
}));

vi.mock('../providers/utils', () => ({
  parseConfigInt: (val: unknown, fallback: number) =>
    typeof val === 'number' ? val : Number(val) || fallback,
}));

vi.mock('../utils/agent-helpers', () => ({
  extractBaseUserId: (id: string) => mockExtractBaseUserId(id),
}));

vi.mock('../utils/realtime', () => ({
  publishToRealtime: (...args: unknown[]) => mockPublishToRealtime(...args),
}));

describe('AgentEmitter', () => {
  let emitter: AgentEmitter;

  beforeEach(() => {
    vi.clearAllMocks();
    emitter = new AgentEmitter({ id: 'agent1', name: 'TestAgent' } as any);
  });

  describe('considerReflection', () => {
    const baseArgs = {
      isIsolated: false,
      userId: 'user1',
      history: Array(25).fill({ role: MessageRole.USER, content: 'msg' }),
      userText: 'hello',
      traceId: 'trace1',
      messages: [{ role: MessageRole.USER, content: 'msg' }],
      responseText: 'response',
      nodeId: 'node1',
      parentId: undefined as string | undefined,
      sessionId: 'session1',
    };

    it('emits reflection when history length matches frequency', async () => {
      mockSend.mockResolvedValue({});
      await emitter.considerReflection(
        baseArgs.isIsolated,
        baseArgs.userId,
        baseArgs.history,
        baseArgs.userText,
        baseArgs.traceId,
        baseArgs.messages,
        baseArgs.responseText,
        baseArgs.nodeId,
        baseArgs.parentId,
        baseArgs.sessionId
      );
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('skips reflection when isolated', async () => {
      await emitter.considerReflection(
        true,
        baseArgs.userId,
        baseArgs.history,
        baseArgs.userText,
        baseArgs.traceId,
        baseArgs.messages,
        baseArgs.responseText,
        baseArgs.nodeId,
        baseArgs.parentId,
        baseArgs.sessionId
      );
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('skips reflection when history is empty', async () => {
      await emitter.considerReflection(
        false,
        baseArgs.userId,
        [],
        baseArgs.userText,
        baseArgs.traceId,
        baseArgs.messages,
        baseArgs.responseText,
        baseArgs.nodeId,
        baseArgs.parentId,
        baseArgs.sessionId
      );
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('triggers reflection on "remember" keyword', async () => {
      mockSend.mockResolvedValue({});
      await emitter.considerReflection(
        false,
        baseArgs.userId,
        [{ role: MessageRole.USER, content: 'msg' }],
        'please remember this',
        baseArgs.traceId,
        baseArgs.messages,
        baseArgs.responseText,
        baseArgs.nodeId,
        baseArgs.parentId,
        baseArgs.sessionId
      );
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('triggers reflection on "learn" keyword', async () => {
      mockSend.mockResolvedValue({});
      await emitter.considerReflection(
        false,
        baseArgs.userId,
        [{ role: MessageRole.USER, content: 'msg' }],
        'I want to learn something',
        baseArgs.traceId,
        baseArgs.messages,
        baseArgs.responseText,
        baseArgs.nodeId,
        baseArgs.parentId,
        baseArgs.sessionId
      );
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('handles EventBridge send failure gracefully', async () => {
      mockSend.mockRejectedValue(new Error('EB down'));
      await expect(
        emitter.considerReflection(
          false,
          baseArgs.userId,
          baseArgs.history,
          baseArgs.userText,
          baseArgs.traceId,
          baseArgs.messages,
          baseArgs.responseText,
          baseArgs.nodeId,
          baseArgs.parentId,
          baseArgs.sessionId
        )
      ).resolves.not.toThrow();
      const { logger } = await import('../logger');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('emitContinuation', () => {
    it('emits continuation event to EventBridge', async () => {
      mockSend.mockResolvedValue({});
      await emitter.emitContinuation('user1', 'continue task', 'trace1', {
        depth: 2,
        sessionId: 'session1',
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('includes continuation metadata', async () => {
      mockSend.mockResolvedValue({});
      await emitter.emitContinuation('user1', 'task', 'trace1', {
        depth: 0,
        nodeId: 'node1',
        parentId: 'parent1',
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('handles send failure gracefully', async () => {
      mockSend.mockRejectedValue(new Error('EB down'));
      await expect(emitter.emitContinuation('user1', 'task', 'trace1', {})).resolves.not.toThrow();
    });
  });

  describe('emitChunk', () => {
    it('publishes to correct MQTT topic with session', async () => {
      mockPublishToRealtime.mockResolvedValue(undefined);
      await emitter.emitChunk('user1', 'session1', 'trace1', 'hello');
      expect(mockPublishToRealtime).toHaveBeenCalledTimes(1);
      expect(mockPublishToRealtime.mock.calls[0][0]).toBe('users/user1/sessions/session1/signal');
    });

    it('publishes to topic without session', async () => {
      mockPublishToRealtime.mockResolvedValue(undefined);
      await emitter.emitChunk('user1', undefined, 'trace1', 'hello');
      expect(mockPublishToRealtime.mock.calls[0][0]).toBe('users/user1/signal');
    });

    it('sanitizes special characters in userId for MQTT', async () => {
      mockExtractBaseUserId.mockReturnValue('user+1#test');
      mockPublishToRealtime.mockResolvedValue(undefined);
      await emitter.emitChunk('user+1#test', 'session1', 'trace1', 'hello');
      const topic = mockPublishToRealtime.mock.calls[0][0];
      expect(topic).toBe('users/user_1_test/sessions/session1/signal');
    });

    it('uses traceId as messageId for superclaw agent', async () => {
      mockPublishToRealtime.mockResolvedValue(undefined);
      const superEmitter = new AgentEmitter({ id: 'superclaw', name: 'SuperClaw' } as any);
      await superEmitter.emitChunk('user1', 'session1', 'trace1', 'hello');
      const payload = mockPublishToRealtime.mock.calls[0][1];
      expect(payload.messageId).toBe('trace1');
    });

    it('uses traceId-agentId as messageId for sub-agents', async () => {
      mockPublishToRealtime.mockResolvedValue(undefined);
      await emitter.emitChunk('user1', 'session1', 'trace1', 'hello');
      const payload = mockPublishToRealtime.mock.calls[0][1];
      expect(payload.messageId).toBe('trace1-agent1');
    });

    it('handles publish failure gracefully', async () => {
      mockPublishToRealtime.mockRejectedValue(new Error('IoT down'));
      await expect(
        emitter.emitChunk('user1', 'session1', 'trace1', 'hello')
      ).resolves.not.toThrow();
    });
  });
});
