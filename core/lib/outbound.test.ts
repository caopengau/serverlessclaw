import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendOutboundMessage } from './outbound';
import type { Attachment } from './types/agent';

// Mock the emitEvent function
vi.mock('./utils/bus', () => ({
  emitEvent: vi.fn().mockResolvedValue(undefined),
}));

describe('sendOutboundMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send outbound message with required parameters', async () => {
    const { emitEvent } = await import('./utils/bus');

    await sendOutboundMessage('test.source', 'user123', 'Hello world');

    expect(emitEvent).toHaveBeenCalledWith('test.source', expect.any(String), {
      userId: 'user123',
      message: 'Hello world',
      memoryContexts: undefined,
      sessionId: undefined,
      agentName: undefined,
      attachments: undefined,
    });
  });

  it('should send outbound message with all parameters', async () => {
    const { emitEvent } = await import('./utils/bus');

    const attachments: Attachment[] = [
      { type: 'file', name: 'file.txt', url: 'https://example.com/file.txt' },
    ];

    await sendOutboundMessage(
      'test.source',
      'user123',
      'Hello',
      ['ctx1'],
      'session1',
      'Agent1',
      attachments
    );

    expect(emitEvent).toHaveBeenCalledWith('test.source', expect.any(String), {
      userId: 'user123',
      message: 'Hello',
      memoryContexts: ['ctx1'],
      sessionId: 'session1',
      agentName: 'Agent1',
      attachments,
    });
  });
});
