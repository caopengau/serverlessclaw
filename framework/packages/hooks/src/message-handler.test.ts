import { describe, it, expect } from 'vitest';
import {
  applyChunkToMessages,
  shouldProcessChunk,
  mergeHistoryWithMessages,
} from './message-handler';
import { ChatMessage, HistoryMessage, IncomingChunk } from './types';

describe('shouldProcessChunk', () => {
  it('returns true when chunk has no sessionId (general topic)', () => {
    const chunk: IncomingChunk & { 'detail-type': string } = {
      message: 'Hello',
      messageId: 'trace-1',
      userId: 'user-1',
      'detail-type': 'chunk',
    };
    expect(shouldProcessChunk(chunk, 'sess-1', 'user-1')).toBe(true);
  });

  it('normalizes incoming userId by stripping CONV# prefix', () => {
    const chunk: IncomingChunk & { 'detail-type': string } = {
      message: 'Hello',
      messageId: 'trace-1',
      userId: 'CONV#user-1#sess-1',
      sessionId: 'sess-1',
      'detail-type': 'chunk',
    };
    expect(shouldProcessChunk(chunk, 'sess-1', 'user-1')).toBe(true);
  });

  it('handles incoming userId with CONV# prefix but no additional # segments', () => {
    const chunk: IncomingChunk & { 'detail-type': string } = {
      message: 'Hello',
      messageId: 'trace-1',
      userId: 'CONV#user-1',
      sessionId: 'sess-1',
      'detail-type': 'chunk',
    };
    expect(shouldProcessChunk(chunk, 'sess-1', 'user-1')).toBe(true);
  });

  it('returns true when chunk sessionId matches active session', () => {
    const chunk: IncomingChunk & { 'detail-type': string } = {
      message: 'Hello',
      messageId: 'trace-1',
      userId: 'user-1',
      sessionId: 'sess-1',
      'detail-type': 'chunk',
    };
    expect(shouldProcessChunk(chunk, 'sess-1', 'user-1')).toBe(true);
  });

  it('returns false when chunk sessionId does not match active session', () => {
    const chunk: IncomingChunk & { 'detail-type': string } = {
      message: 'Hello',
      messageId: 'trace-1',
      userId: 'user-1',
      sessionId: 'sess-2',
      'detail-type': 'chunk',
    };
    expect(shouldProcessChunk(chunk, 'sess-1', 'user-1')).toBe(false);
  });

  it('returns true even when chunk has no message and no thought (may have options/tools)', () => {
    const chunk: IncomingChunk & { 'detail-type': string } = {
      messageId: 'trace-1',
      userId: 'user-1',
      sessionId: 'sess-1',
      'detail-type': 'chunk',
    };
    expect(shouldProcessChunk(chunk, 'sess-1', 'user-1')).toBe(true);
  });

  it('returns true when chunk has empty message but isThought is set', () => {
    const chunk: IncomingChunk & { 'detail-type': string } = {
      userId: 'user-1',
      messageId: 'trace-1',
      sessionId: 'sess-1',
      message: '',
      isThought: true,
      'detail-type': 'chunk',
    };
    expect(shouldProcessChunk(chunk, 'sess-1', 'user-1')).toBe(true);
  });

  it('returns false when chunk userId does not match', () => {
    const chunk: IncomingChunk & { 'detail-type': string } = {
      message: 'Hello',
      messageId: 'trace-1',
      userId: 'other-user',
      sessionId: 'sess-1',
      'detail-type': 'chunk',
    };
    expect(shouldProcessChunk(chunk, 'sess-1', 'user-1')).toBe(false);
  });

  it('returns true for outbound_message event type for final synchronization', () => {
    const chunk: IncomingChunk & { 'detail-type': string } = {
      message: 'Hello',
      messageId: 'trace-1',
      userId: 'user-1',
      sessionId: 'sess-1',
      'detail-type': 'outbound_message',
    };
    expect(shouldProcessChunk(chunk, 'sess-1', 'user-1')).toBe(true);
  });

  it('returns false when chunk is missing messageId', () => {
    const chunk: IncomingChunk & { 'detail-type': string } = {
      message: 'Hello',
      userId: 'user-1',
      sessionId: 'sess-1',
      'detail-type': 'TEXT_MESSAGE_CONTENT',
    };
    expect(shouldProcessChunk(chunk, 'sess-1', 'user-1')).toBe(false);
  });

  it('treats dashboard-user as wildcard and allows session-matched chunks', () => {
    const chunk: IncomingChunk & { 'detail-type': string } = {
      message: 'streaming chunk',
      messageId: 'trace-2',
      userId: 'session_abc123',
      sessionId: 'sess-1',
      'detail-type': 'TEXT_MESSAGE_CONTENT',
    };
    expect(shouldProcessChunk(chunk, 'sess-1', 'dashboard-user')).toBe(true);
  });

  it('still rejects session-mismatched chunks for dashboard-user wildcard', () => {
    const chunk: IncomingChunk & { 'detail-type': string } = {
      message: 'streaming chunk',
      messageId: 'trace-3',
      userId: 'session_abc123',
      sessionId: 'sess-2',
      'detail-type': 'TEXT_MESSAGE_CONTENT',
    };
    expect(shouldProcessChunk(chunk, 'sess-1', 'dashboard-user')).toBe(false);
  });

  it('returns false when userId mismatch', () => {
    const chunk: IncomingChunk & { 'detail-type': string } = {
      messageId: 't1',
      userId: 'other-user',
      'detail-type': 'chunk',
    };
    expect(shouldProcessChunk(chunk, 'sess-1', 'user-1')).toBe(false);
  });

  it('allows chunks for dashboard-user when sessionId matches', () => {
    const chunk: IncomingChunk & { 'detail-type': string } = {
      message: 'hi',
      messageId: 't1',
      userId: 'session_123',
      sessionId: 'sess-1',
      'detail-type': 'TEXT_MESSAGE_CONTENT',
    };
    expect(shouldProcessChunk(chunk, 'sess-1', 'dashboard-user')).toBe(true);
  });
});

describe('applyChunkToMessages', () => {
  it('links chunk to a thinking placeholder if messageId is new', () => {
    const prev: ChatMessage[] = [
      { role: 'assistant', content: '', isThinking: true, agentName: 'SuperClaw' },
    ];
    const chunk: IncomingChunk = {
      message: 'Initial content',
      messageId: 'new-trace-id',
    };

    const result = applyChunkToMessages(prev, chunk);

    expect(result).toHaveLength(1);
    expect(result[0].messageId).toBe('new-trace-id');
    expect(result[0].content).toBe('Initial content');
    expect(result[0].isThinking).toBe(false);
  });

  it('replaces content instead of appending when detail-type is outbound_message', () => {
    const prev: ChatMessage[] = [
      { role: 'assistant', content: 'Partial...', messageId: 't1', agentName: 'SuperClaw' },
    ];
    const chunk: IncomingChunk & { 'detail-type': string } = {
      message: 'Full final response',
      messageId: 't1',
      'detail-type': 'outbound_message',
    };

    const result = applyChunkToMessages(prev, chunk);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Full final response');
  });

  it('drops duplicate assistant messages based on exact content match', () => {
    const prev: ChatMessage[] = [
      { role: 'assistant', content: 'Hello there', messageId: 't1', agentName: 'SuperClaw' },
    ];
    const chunk: IncomingChunk = {
      message: 'Hello there',
      messageId: 't2',
    };

    const result = applyChunkToMessages(prev, chunk);

    expect(result).toHaveLength(1);
    expect(result[0].messageId).toBe('t1');
  });

  it('appends thought deltas to an existing message', () => {
    const prev: ChatMessage[] = [
      {
        role: 'assistant',
        content: '',
        thought: 'I am ',
        messageId: 't1',
        agentName: 'SuperClaw',
      },
    ];
    const chunk: IncomingChunk = {
      isThought: true,
      thought: 'thinking',
      messageId: 't1',
    };

    const result = applyChunkToMessages(prev, chunk);

    expect(result).toHaveLength(1);
    expect(result[0].thought).toBe('I am thinking');
  });

  it('stops thinking when non-thought content arrives', () => {
    const prev: ChatMessage[] = [
      {
        role: 'assistant',
        content: '',
        isThinking: true,
        messageId: 't1',
        agentName: 'SuperClaw',
      },
    ];
    const chunk: IncomingChunk = {
      message: 'Here is the answer',
      messageId: 't1',
    };

    const result = applyChunkToMessages(prev, chunk);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Here is the answer');
    expect(result[0].isThinking).toBe(false);
  });

  it('skips chunks for already seen message IDs', () => {
    const prev: ChatMessage[] = [];
    const seenIds = new Set(['trace-1']);
    const chunk: IncomingChunk = { message: 'hi', messageId: 'trace-1' };

    const result = applyChunkToMessages(prev, chunk, seenIds);

    expect(result).toHaveLength(0);
  });

  it('propagates usage and model information to the message', () => {
    const prev: ChatMessage[] = [
      { role: 'assistant', content: 'Partial...', messageId: 't1', agentName: 'SuperClaw' },
    ];
    const chunk: IncomingChunk = {
      message: ' Final',
      messageId: 't1',
      model: 'gpt-4o',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    };

    const result = applyChunkToMessages(prev, chunk);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Partial... Final');
    expect(result[0].modelName).toBe('gpt-4o');
    expect(result[0].usage?.total_tokens).toBe(150);
  });
});

describe('mergeHistoryWithMessages', () => {
  it('discards local assistant messages if history has the same normalized ID', () => {
    const prev: ChatMessage[] = [
      { role: 'assistant', content: 'Local version', messageId: 'trace-1-superclaw' },
    ];
    const rawHistory: HistoryMessage[] = [
      { role: 'assistant', content: 'History version', traceId: 'trace-1', attachments: [] },
    ];

    const { messages } = mergeHistoryWithMessages(prev, rawHistory);

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('History version');
  });

  it('discards local user messages if they match history content', () => {
    const prev: ChatMessage[] = [{ role: 'user', content: 'Same user text', messageId: 'u1' }];
    const rawHistory: HistoryMessage[] = [
      { role: 'user', content: 'Same user text', messageId: 'u1', attachments: [] },
    ];

    const { messages } = mergeHistoryWithMessages(prev, rawHistory);

    expect(messages).toHaveLength(1);
  });
});
