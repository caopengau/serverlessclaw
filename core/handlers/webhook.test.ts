import { describe, it, expect, vi, beforeEach } from 'vitest';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Mock sst Resource BEFORE other imports
vi.mock('sst', () => ({
  Resource: {
    TelegramBotToken: { value: 'mock-token' },
    StagingBucket: { name: 'mock-bucket' },
  },
}));

import { handler } from './webhook';
import { mockClient } from 'aws-sdk-client-mock';

// Mock dependencies
const mockAgentProcess = vi.fn().mockResolvedValue('Mocked response');

vi.mock('../lib/agent', () => ({
  Agent: class {
    process = mockAgentProcess;
  },
}));

vi.mock('../lib/memory', () => ({
  DynamoMemory: class {},
}));

vi.mock('../lib/providers/index', () => ({
  ProviderManager: class {},
}));

vi.mock('../lib/lock', () => ({
  DynamoLockManager: class {
    acquire = vi.fn().mockResolvedValue(true);
    release = vi.fn().mockResolvedValue(true);
  },
}));

vi.mock('../lib/registry', () => ({
  AgentRegistry: {
    getAgentConfig: vi.fn().mockResolvedValue({
      id: 'main',
      systemPrompt: 'Mocked prompt',
    }),
  },
}));

vi.mock('../tools/index', () => ({
  getAgentTools: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/outbound', () => ({
  sendOutboundMessage: vi.fn().mockResolvedValue(undefined),
}));

const s3Mock = mockClient(S3Client);

// Mock global fetch
global.fetch = vi.fn();

describe('Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    s3Mock.reset();
  });

  it('should process simple text message', async () => {
    const event = {
      body: JSON.stringify({
        update_id: 12345,
        message: {
          chat: { id: 123456789 },
          text: 'Hello bot',
        },
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await handler(event, {} as any)) as any;

    expect(result.statusCode).toBe(200);
    expect(mockAgentProcess).toHaveBeenCalledWith('123456789', 'Hello bot', expect.anything());
  });

  it('should process photo attachment', async () => {
    const event = {
      body: JSON.stringify({
        update_id: 12345,
        message: {
          chat: { id: 123456789 },
          text: 'Check this photo',
          photo: [{ file_id: 'small_id' }, { file_id: 'large_id' }],
        },
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // Mock Telegram getFile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, result: { file_path: 'photos/file.jpg' } }),
      })
      // Mock File Download
      .mockResolvedValueOnce({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });

    s3Mock.on(PutObjectCommand).resolves({});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await handler(event, {} as any)) as any;

    expect(result.statusCode).toBe(200);
    expect(s3Mock.calls().length).toBe(1);

    expect(mockAgentProcess).toHaveBeenCalledWith(
      '123456789',
      'Check this photo',
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            type: 'image',
            url: expect.stringContaining('.s3.'),
          }),
        ],
      })
    );
  });
});
