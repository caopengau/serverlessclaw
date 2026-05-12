import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClawTracer } from './tracer-implementation';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TRACE_TYPES } from '../constants';

// Mock ddb-client
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock('../utils/ddb-client', () => ({
  getDocClient: () => ({ send: mockSend }),
  getTraceTableName: () => 'TraceTable',
}));

// Mock FlowController
vi.mock('../routing/flow-controller', () => ({
  FlowController: {
    areTraceSummariesEnabled: vi.fn().mockResolvedValue(false),
  },
}));

describe('ClawTracer Update Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include workspaceId in ConditionExpression for addStep', async () => {
    const tracer = new ClawTracer('user-1', 'test', 'trace-1', 'root', undefined, 'agent-1', {
      workspaceId: 'ws-1',
    });

    mockSend.mockResolvedValueOnce({}); // UpdateCommand response

    await tracer.addStep({ type: TRACE_TYPES.LLM_CALL, content: 'thinking' });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          ConditionExpression: expect.stringContaining('workspaceId = :wsId'),
          ExpressionAttributeValues: expect.objectContaining({
            ':wsId': 'ws-1',
          }),
        }),
      })
    );
  });

  it('should NOT include workspaceId in ConditionExpression if not provided to tracer', async () => {
    const tracer = new ClawTracer('user-1', 'test', 'trace-1', 'root', undefined, 'agent-1');

    mockSend.mockResolvedValueOnce({});

    await tracer.addStep({ type: TRACE_TYPES.LLM_CALL, content: 'thinking' });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          ConditionExpression: 'attribute_exists(traceId)',
        }),
      })
    );

    // Ensure :wsId is NOT in values
    const call = mockSend.mock.calls[0][0] as UpdateCommand;
    expect(call.input.ExpressionAttributeValues).not.toHaveProperty(':wsId');
  });

  it('should include workspaceId in endTrace', async () => {
    const tracer = new ClawTracer('user-1', 'test', 'trace-1', 'root', undefined, 'agent-1', {
      workspaceId: 'ws-1',
    });

    mockSend.mockResolvedValue({}); // endTrace has multiple steps sometimes if summary enabled

    await tracer.endTrace('done');

    // Find the endTrace call
    const endTraceCall = mockSend.mock.calls.find((c) =>
      (c[0] as UpdateCommand).input.UpdateExpression?.includes('finalResponse = :resp')
    );

    expect(endTraceCall?.[0]).toMatchObject({
      input: expect.objectContaining({
        ConditionExpression: expect.stringContaining('workspaceId = :wsId'),
        ExpressionAttributeValues: expect.objectContaining({
          ':wsId': 'ws-1',
        }),
      }),
    });
  });

  it('should pass workspaceId to FlowController.areTraceSummariesEnabled', async () => {
    const { FlowController } = await import('../routing/flow-controller');
    const tracer = new ClawTracer('user-1', 'test', 'trace-1', 'root', undefined, 'agent-1', {
      workspaceId: 'ws-1',
    });

    mockSend.mockResolvedValue({});
    await tracer.endTrace('done');

    expect(FlowController.areTraceSummariesEnabled).toHaveBeenCalledWith('ws-1');
  });
});
