import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyChunkToMessages,
  shouldProcessChunk,
  mapHistoryMessage,
  mergeHistoryWithMessages,
  IncomingChunk,
} from './message-handler';
import { ChatMessage, HistoryMessage } from './types';

describe('shouldProcessChunk', () => {
  it('returns true when chunk has no sessionId (general topic)', () => {
    const chunk: IncomingChunk = { message: 'Hello', userId: 'user-1' };
    expect(shouldProcessChunk(chunk, 'sess-1', 'user-1')).toBe(true);
  });

  it('returns true when chunk sessionId matches active session', () => {
    const chunk: IncomingChunk = { message: 'Hello', userId: 'user-1', sessionId: 'sess-1' };
    expect(shouldProcessChunk(chunk, 'sess-1', 'user-1')).toBe(true);
  });

  it('returns false when chunk sessionId does not match active session', () => {
    const chunk: IncomingChunk = { message: 'Hello', userId: 'user-1', sessionId: 'sess-2' };
    expect(shouldProcessChunk(chunk, 'sess-1', 'user-1')).toBe(false);
  });

  it('returns false when chunk has no message and no thought', () => {
    const chunk: IncomingChunk = { userId: 'user-1', sessionId: 'sess-1' };
    expect(shouldProcessChunk(chunk, 'sess-1', 'user-1')).toBe(false);
  });

  it('returns true when chunk has empty message but isThought is set', () => {
    const chunk: IncomingChunk = { userId: 'user-1', sessionId: 'sess-1', message: '', isThought: true };
    expect(shouldProcessChunk(chunk, 'sess-1', 'user-1')).toBe(true);
  });

  it('returns false when chunk userId does not match', () => {
    const chunk: IncomingChunk = { message: 'Hello', userId: 'other-user', sessionId: 'sess-1' };
    expect(shouldProcessChunk(chunk, 'sess-1', 'user-1')).toBe(false);
  });
});

describe('applyChunkToMessages', () => {
  let seenIds: Set<string>;

  beforeEach(() => {
    seenIds = new Set<string>();
  });

  it('appends a new assistant message on first chunk', () => {
    const prev: ChatMessage[] = [{ role: 'user', content: 'Hi' }];
    const chunk: IncomingChunk = {
      message: 'Hello',
      messageId: 'trace-1',
      agentName: 'SuperClaw',
    };

    const result = applyChunkToMessages(prev, chunk, seenIds);

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      role: 'assistant',
      content: 'Hello',
      messageId: 'trace-1',
      agentName: 'SuperClaw',
    });
  });

  it('appends content to existing message on subsequent chunks', () => {
    const prev: ChatMessage[] = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hel', messageId: 'trace-1', agentName: 'SuperClaw' },
    ];
    const chunk: IncomingChunk = { message: 'lo', messageId: 'trace-1' };

    const result = applyChunkToMessages(prev, chunk, seenIds);

    expect(result).toHaveLength(2);
    expect(result[1].content).toBe('Hello');
  });

  it('accumulates thought chunks on existing message', () => {
    const prev: ChatMessage[] = [
      { role: 'assistant', content: '', thought: 'Let me', messageId: 'trace-1', agentName: 'SuperClaw' },
    ];
    const chunk: IncomingChunk = { message: ' think', messageId: 'trace-1', isThought: true };

    const result = applyChunkToMessages(prev, chunk, seenIds);

    expect(result).toHaveLength(1);
    expect(result[0].thought).toBe('Let me think');
    expect(result[0].content).toBe('');
  });

  it('creates thought-only message for first thought chunk', () => {
    const prev: ChatMessage[] = [{ role: 'user', content: 'Hi' }];
    const chunk: IncomingChunk = {
      message: 'Thinking...',
      messageId: 'trace-1',
      isThought: true,
      agentName: 'SuperClaw',
    };

    const result = applyChunkToMessages(prev, chunk, seenIds);

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      role: 'assistant',
      content: '',
      thought: 'Thinking...',
      messageId: 'trace-1',
    });
  });

  it('drops duplicate messages via isDuplicate', () => {
    const prev: ChatMessage[] = [
      { role: 'assistant', content: 'Hello', messageId: 'trace-1', agentName: 'SuperClaw' },
    ];
    // Same messageId already exists in prev → should be treated as existing message update
    const chunk: IncomingChunk = { message: ' world', messageId: 'trace-1' };

    const result = applyChunkToMessages(prev, chunk, seenIds);

    // Should append to existing, not create new
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Hello world');
  });

  it('drops duplicate message without messageId when same content exists', () => {
    const prev: ChatMessage[] = [
      { role: 'assistant', content: 'Same content', agentName: 'SuperClaw' },
    ];
    const chunk: IncomingChunk = { message: 'Same content' };

    const result = applyChunkToMessages(prev, chunk, seenIds);

    expect(result).toHaveLength(1);
  });

  it('preserves options on existing message when chunk has options', () => {
    const prev: ChatMessage[] = [
      { role: 'assistant', content: 'Approve?', messageId: 'trace-1', agentName: 'SuperClaw' },
    ];
    const options = [{ label: 'Approve', value: 'APPROVE', type: 'primary' as const }];
    const chunk: IncomingChunk = { message: '', messageId: 'trace-1', options };

    const result = applyChunkToMessages(prev, chunk, seenIds);

    expect(result[0].options).toEqual(options);
  });

  it('merges tool_calls from chunk into existing message', () => {
    const prev: ChatMessage[] = [
      { role: 'assistant', content: 'Calling tool...', messageId: 'trace-1', agentName: 'SuperClaw' },
    ];
    const toolCalls = [{ id: 'tc-1', type: 'function' as const, function: { name: 'test', arguments: '{}' } }];
    const chunk: IncomingChunk = { message: '', messageId: 'trace-1', toolCalls };

    const result = applyChunkToMessages(prev, chunk, seenIds);

    expect(result[0].tool_calls).toEqual(toolCalls);
  });

  it('handles tool_calls under alternate key name (tool_calls)', () => {
    const prev: ChatMessage[] = [
      { role: 'assistant', content: 'Calling tool...', messageId: 'trace-1', agentName: 'SuperClaw' },
    ];
    const toolCalls = [{ id: 'tc-1', type: 'function' as const, function: { name: 'test', arguments: '{}' } }];
    const chunk: IncomingChunk = { message: '', messageId: 'trace-1', tool_calls: toolCalls };

    const result = applyChunkToMessages(prev, chunk, seenIds);

    expect(result[0].tool_calls).toEqual(toolCalls);
  });

  it('preserves empty content streaming placeholder during multi-chunk stream', () => {
    // Simulates: placeholder created, then thought chunk, then content chunk
    const prev: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: '', messageId: 'trace-1', agentName: 'SuperClaw' },
    ];

    // First content chunk
    const chunk1: IncomingChunk = { message: 'Hi ', messageId: 'trace-1' };
    const result1 = applyChunkToMessages(prev, chunk1, seenIds);

    expect(result1[1].content).toBe('Hi ');

    // Second content chunk
    const chunk2: IncomingChunk = { message: 'there!', messageId: 'trace-1' };
    const result2 = applyChunkToMessages(result1, chunk2, seenIds);

    expect(result2[1].content).toBe('Hi there!');
    expect(result2).toHaveLength(2);
  });
});

describe('mapHistoryMessage', () => {
  it('maps traceId to messageId for deduplication', () => {
    const historyMsg: HistoryMessage = {
      role: 'assistant',
      content: 'Hello',
      traceId: 'trace-abc',
      agentName: 'SuperClaw',
      attachments: undefined,
    };

    const result = mapHistoryMessage(historyMsg);

    expect(result.messageId).toBe('trace-abc');
    expect(result.role).toBe('assistant');
    expect(result.content).toBe('Hello');
  });

  it('maps system role to assistant role', () => {
    const historyMsg: HistoryMessage = {
      role: 'system',
      content: 'System message',
      traceId: 'trace-sys',
      attachments: undefined,
    };

    const result = mapHistoryMessage(historyMsg);

    expect(result.role).toBe('assistant');
    expect(result.agentName).toBe('SuperClaw');
  });

  it('preserves user role as-is', () => {
    const historyMsg: HistoryMessage = {
      role: 'user',
      content: 'Hi there',
      attachments: undefined,
    };

    const result = mapHistoryMessage(historyMsg);

    expect(result.role).toBe('user');
    expect(result.messageId).toBeUndefined();
  });

  it('preserves attachments, options, and tool_calls', () => {
    const historyMsg: HistoryMessage = {
      role: 'assistant',
      content: 'Done',
      traceId: 'trace-1',
      attachments: [{ type: 'image', url: 'http://img.png' }],
      options: [{ label: 'OK', value: 'ok' }],
      tool_calls: [{ id: 'tc-1', type: 'function', function: { name: 'test', arguments: '{}' } }],
    };

    const result = mapHistoryMessage(historyMsg);

    expect(result.attachments).toEqual(historyMsg.attachments);
    expect(result.options).toEqual(historyMsg.options);
    expect(result.tool_calls).toEqual(historyMsg.tool_calls);
  });
});

describe('mergeHistoryWithMessages', () => {
  it('maps history messages and includes messageId', () => {
    const prev: ChatMessage[] = [];
    const rawHistory: HistoryMessage[] = [
      { role: 'user', content: 'Hello', attachments: undefined },
      { role: 'assistant', content: 'Hi!', traceId: 'trace-1', attachments: undefined },
    ];

    const { messages, seenIds } = mergeHistoryWithMessages(prev, rawHistory);

    expect(messages).toHaveLength(2);
    expect(messages[1].messageId).toBe('trace-1');
    expect(seenIds.has('trace-1')).toBe(true);
  });

  it('preserves streaming placeholders (empty content + messageId) instead of replacing', () => {
    const prev: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: '', messageId: 'trace-streaming', agentName: 'SuperClaw' },
    ];
    const rawHistory: HistoryMessage[] = [
      { role: 'user', content: 'Hello', attachments: undefined },
      // No assistant response in history yet (still streaming)
    ];

    const { messages } = mergeHistoryWithMessages(prev, rawHistory);

    // Streaming placeholder should be preserved
    expect(messages.some((m) => m.messageId === 'trace-streaming')).toBe(true);
    // User message should not be duplicated
    const userMessages = messages.filter((m) => m.role === 'user');
    expect(userMessages).toHaveLength(1);
  });

  it('does not add duplicate user messages from history during streaming', () => {
    const prev: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: '', messageId: 'trace-streaming', agentName: 'SuperClaw' },
    ];
    const rawHistory: HistoryMessage[] = [
      { role: 'user', content: 'Hello', attachments: undefined },
      { role: 'user', content: 'New message from history', attachments: undefined },
    ];

    const { messages } = mergeHistoryWithMessages(prev, rawHistory);

    // Should add the new user message but not duplicate 'Hello'
    const userMessages = messages.filter((m) => m.role === 'user');
    expect(userMessages).toHaveLength(2);
    expect(userMessages.map((m) => m.content)).toContain('New message from history');
    expect(userMessages.map((m) => m.content)).toContain('Hello');
  });

  it('replaces messages with history when no streaming placeholders exist', () => {
    const prev: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!', agentName: 'SuperClaw' },
    ];
    const rawHistory: HistoryMessage[] = [
      { role: 'user', content: 'Hello', attachments: undefined },
      { role: 'assistant', content: 'Hi!', traceId: 'trace-1', attachments: undefined },
      { role: 'user', content: 'How are you?', attachments: undefined },
      { role: 'assistant', content: 'Good!', traceId: 'trace-2', attachments: undefined },
    ];

    const { messages } = mergeHistoryWithMessages(prev, rawHistory);

    expect(messages).toHaveLength(4);
    expect(messages[3].content).toBe('Good!');
    expect(messages[3].messageId).toBe('trace-2');
  });

  it('preserves local-only error messages not in history', () => {
    const prev: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!', agentName: 'SuperClaw' },
      {
        role: 'assistant',
        content: 'Connection error',
        agentName: 'SystemGuard',
        messageId: 'error-local-1',
        isError: true,
      },
    ];
    const rawHistory: HistoryMessage[] = [
      { role: 'user', content: 'Hello', attachments: undefined },
      { role: 'assistant', content: 'Hi!', traceId: 'trace-1', attachments: undefined },
    ];

    const { messages } = mergeHistoryWithMessages(prev, rawHistory);

    // Local error should be preserved
    expect(messages.some((m) => m.messageId === 'error-local-1')).toBe(true);
  });
});
