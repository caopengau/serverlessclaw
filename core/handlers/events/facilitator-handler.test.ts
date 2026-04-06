import { describe, it, expect, vi } from 'vitest';

vi.mock('./shared', () => ({
  processEventWithAgent: vi.fn().mockResolvedValue({ responseText: 'ok', attachments: [] }),
}));

import { handleFacilitatorTask } from './facilitator-handler';
import { processEventWithAgent } from './shared';
import { AgentType } from '../../lib/types';

describe('handleFacilitatorTask', () => {
  it('parses event and calls processEventWithAgent with FACILITATOR', async () => {
    const event = {
      userId: 'user-1',
      task: 'do something',
      traceId: 'trace-1',
      sessionId: 'sess-1',
      initiatorId: 'initiator-1',
      attachments: [],
    };

    await handleFacilitatorTask(event as any, {} as any);

    expect(processEventWithAgent).toHaveBeenCalled();
    expect((processEventWithAgent as any).mock.calls[0][0]).toBe('user-1');
    expect((processEventWithAgent as any).mock.calls[0][1]).toBe(AgentType.FACILITATOR);
    expect((processEventWithAgent as any).mock.calls[0][2]).toBe('do something');
    const opts = (processEventWithAgent as any).mock.calls[0][3];
    expect(opts).toMatchObject({
      context: {},
      traceId: 'trace-1',
      sessionId: 'sess-1',
      initiatorId: 'initiator-1',
      attachments: [],
      handlerTitle: 'FACILITATOR_TASK',
      outboundHandlerName: 'facilitator-handler',
    });
  });
});
