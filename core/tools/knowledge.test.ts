import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { listAgents, recallKnowledge, manageAgentTools } from './knowledge';

const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock SST Resource
vi.mock('sst', () => ({
  Resource: {
    ConfigTable: { name: 'test-config-table' },
    AgentBus: { name: 'test-bus' },
  },
}));

// Mock DynamoMemory
vi.mock('../lib/memory', () => ({
  DynamoMemory: vi.fn().mockImplementation(function () {
    return {
      searchInsights: vi
        .fn()
        .mockResolvedValue([
          { content: 'insight 1', metadata: { category: 'lesson', impact: 10, urgency: 10 } },
        ]),
      updateGapStatus: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

// Mock AgentRegistry
vi.mock('../lib/registry', () => ({
  AgentRegistry: {
    getAllConfigs: vi.fn().mockResolvedValue({
      main: { id: 'main', name: 'Main', description: 'desc', enabled: true, isBackbone: true },
    }),
    getAgentConfig: vi.fn().mockResolvedValue({ enabled: true }),
  },
}));

describe('knowledge tools', () => {
  beforeEach(() => {
    ddbMock.reset();
    vi.clearAllMocks();
  });

  describe('listAgents', () => {
    it('should return a summary of agents', async () => {
      const result = await listAgents.execute();
      expect(result).toContain('[main] Main');
    });
  });

  describe('recallKnowledge', () => {
    it('should return search results from memory', async () => {
      const result = await recallKnowledge.execute({
        userId: 'user-1',
        query: 'test',
        category: 'tactical_lesson',
      });
      expect(result).toContain('insight 1');
    });
  });

  describe('manageAgentTools', () => {
    it('should update agent tools in DDB', async () => {
      ddbMock.on(PutCommand).resolves({});

      const result = await manageAgentTools.execute({ agentId: 'main', toolNames: ['tool1'] });

      expect(result).toContain('Successfully updated tools');
      expect(ddbMock.calls()).toHaveLength(1);
    });
  });
});
