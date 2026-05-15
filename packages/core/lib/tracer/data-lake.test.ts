import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToDataLake } from './data-lake';
import { ClawTracer } from './tracer-implementation';
import { TRACE_STATUS } from '../constants';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock('sst', () => ({
  Resource: {
    DataLakeBucket: { name: 'test-data-lake-bucket' },
  },
}));

vi.mock('@aws-sdk/client-s3', async () => {
  const actual = await vi.importActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: class {
      send = mockSend;
    },
  };
});

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./tracer-implementation', () => ({
  ClawTracer: {
    getTrace: vi.fn(),
  },
}));

describe('DataLake Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  it('should export completed traces', async () => {
    vi.mocked(ClawTracer.getTrace).mockResolvedValueOnce([
      {
        traceId: 'trace-1',
        nodeId: 'root',
        userId: 'user-1',
        agentId: 'coder-agent',
        status: TRACE_STATUS.COMPLETED,
        source: 'system',
        timestamp: 1000,
        initialContext: {},
        steps: [],
        expiresAt: 2000,
      },
    ]);

    await exportToDataLake('trace-1', 'ws-1');

    expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    const cmd = mockSend.mock.calls[0][0] as PutObjectCommand;
    expect(cmd.input.Bucket).toBe('test-data-lake-bucket');
    expect(cmd.input.Key).toContain('tuning-traces/');
    expect(cmd.input.Key).toContain('/coder-agent/trace-1.jsonl');

    const body = JSON.parse((cmd.input.Body as string).trim());
    expect(body.traceId).toBe('trace-1');
    expect(body.agentId).toBe('coder-agent');
    expect(body.nodes[0].userId).toBe('ANONYMIZED');
  });

  it('should not export traces with errors', async () => {
    vi.mocked(ClawTracer.getTrace).mockResolvedValueOnce([
      {
        traceId: 'trace-2',
        nodeId: 'root',
        userId: 'user-1',
        agentId: 'coder-agent',
        status: TRACE_STATUS.COMPLETED,
        source: 'system',
        timestamp: 1000,
        initialContext: {},
        steps: [],
        expiresAt: 2000,
        failureReason: 'Something went wrong',
      },
    ]);

    await exportToDataLake('trace-2');

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should not export traces over token budget', async () => {
    vi.mocked(ClawTracer.getTrace).mockResolvedValueOnce([
      {
        traceId: 'trace-3',
        nodeId: 'root',
        userId: 'user-1',
        agentId: 'coder-agent',
        status: TRACE_STATUS.COMPLETED,
        source: 'system',
        timestamp: 1000,
        initialContext: {},
        steps: [],
        expiresAt: 2000,
      },
    ]);

    const highTokenUsage = {
      userId: 'user-1',
      timestamp: 1000,
      traceId: 'trace-3',
      agentId: 'coder-agent',
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 30000,
      outputTokens: 25000,
      totalTokens: 55000,
      toolCalls: 5,
      taskType: 'agent_process' as const,
      success: true,
      durationMs: 5000,
      expiresAt: 2000,
    };

    await exportToDataLake('trace-3', undefined, highTokenUsage);

    expect(mockSend).not.toHaveBeenCalled();
  });
});
