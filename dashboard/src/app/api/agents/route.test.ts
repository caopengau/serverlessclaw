import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetAllConfigs = vi.fn();
const mockSend = vi.fn();

vi.mock('sst', () => ({
  Resource: {
    ConfigTable: { name: 'test-config-table' },
  },
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class {},
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  PutCommand: class {},
}));

vi.mock('@claw/core/lib/registry', () => ({
  AgentRegistry: {
    getAllConfigs: mockGetAllConfigs,
  },
}));

vi.mock('@/lib/constants', () => ({
  HTTP_STATUS: { INTERNAL_SERVER_ERROR: 500 },
  DYNAMO_KEYS: { AGENTS_CONFIG: 'agents_config' },
}));

describe('Agents API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns agent configs on success', async () => {
      const configs = [{ id: 'superclaw', name: 'SuperClaw' }];
      mockGetAllConfigs.mockResolvedValue(configs);

      const { GET } = await import('./route');
      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual(configs);
    });

    it('returns 500 on error', async () => {
      mockGetAllConfigs.mockRejectedValue(new Error('DynamoDB error'));

      const { GET } = await import('./route');
      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Failed to fetch agents');
    });
  });

  describe('POST', () => {
    it('saves agent config and returns success', async () => {
      mockSend.mockResolvedValue({});

      const { POST } = await import('./route');
      const req = new NextRequest('http://localhost/api/agents', {
        method: 'POST',
        body: JSON.stringify({ agents: [{ id: 'test' }] }),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSend).toHaveBeenCalled();
    });

    it('returns 500 on DynamoDB error', async () => {
      mockSend.mockRejectedValue(new Error('Write failed'));

      const { POST } = await import('./route');
      const req = new NextRequest('http://localhost/api/agents', {
        method: 'POST',
        body: JSON.stringify({ agents: [] }),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Failed to update agents');
    });
  });
});
