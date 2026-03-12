import { describe, it, expect, vi } from 'vitest';

// Mock SST Resource
vi.mock('sst', () => ({
  Resource: {
    MemoryTable: { name: 'test-memory-table' },
    TraceTable: { name: 'test-trace-table' },
    ConfigTable: { name: 'test-config-table' },
  },
}));

// Mock DynamoDB client
vi.mock('@aws-sdk/client-dynamodb', () => {
  return {
    DynamoDBClient: function () {
      return {
        send: vi.fn(),
      };
    },
  };
});

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: vi.fn(),
    })),
  },
  GetCommand: vi.fn(),
  PutCommand: vi.fn(),
  QueryCommand: vi.fn(),
  UpdateCommand: vi.fn(),
}));

import { BACKBONE_REGISTRY } from './backbone';
import { AgentType, AgentCategory } from './types/agent';

describe('Backbone Registry Categories', () => {
  it('should have SYSTEM category for all backbone agents', () => {
    Object.values(BACKBONE_REGISTRY).forEach((config) => {
      expect(config.category).toBe(AgentCategory.SYSTEM);
    });
  });

  it('should have specific backbone agents defined', () => {
    expect(BACKBONE_REGISTRY[AgentType.MAIN]).toBeDefined();
    expect(BACKBONE_REGISTRY[AgentType.CODER]).toBeDefined();
    expect(BACKBONE_REGISTRY[AgentType.STRATEGIC_PLANNER]).toBeDefined();
    expect(BACKBONE_REGISTRY[AgentType.COGNITION_REFLECTOR]).toBeDefined();
    expect(BACKBONE_REGISTRY[AgentType.QA]).toBeDefined();
  });
});
