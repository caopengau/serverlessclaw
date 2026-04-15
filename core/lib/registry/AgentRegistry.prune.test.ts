import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRegistry } from './AgentRegistry';
import { ConfigManager } from './config';
import { DYNAMO_KEYS } from '../constants';

const { mockDocClient } = vi.hoisted(() => ({
  mockDocClient: {
    send: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('./config', () => ({
  ConfigManager: {
    getRawConfig: vi.fn(),
    saveRawConfig: vi.fn().mockResolvedValue(undefined),
    atomicUpdateMapField: vi.fn().mockResolvedValue(undefined),
    atomicUpdateMapEntity: vi.fn().mockResolvedValue(undefined),
    atomicRemoveFromMap: vi.fn().mockResolvedValue(undefined),
  },
  defaultDocClient: mockDocClient,
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: vi.fn(),
    })),
  },
  DeleteCommand: vi.fn(),
}));

vi.mock('../utils/topology', () => ({
  discoverSystemTopology: vi.fn(async () => ({})),
}));

vi.mock('sst', () => ({
  Resource: {
    ConfigTable: { name: 'mock-config-table' },
  },
}));

// Verified fix: It no longer deletes the entire key but updates the list
describe('AgentRegistry Pruning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prune tools from both legacy per-agent config and batch overrides', async () => {
    const now = Date.now();
    const thresholdMs = 30 * 24 * 60 * 60 * 1000;
    const oldTimestamp = now - thresholdMs - 1000;

    // 1. Mock per-agent tool usage: toolA is unused and old
    vi.mocked(ConfigManager.getRawConfig).mockImplementation(async (key) => {
      if (key === DYNAMO_KEYS.TOOL_USAGE) {
        return {
          'WS#default#toolA': { count: 0, firstRegistered: oldTimestamp },
        };
      }
      if (key === DYNAMO_KEYS.AGENTS_CONFIG) {
        return {
          'WS#default#agent1': { name: 'Agent 1', tools: [] },
        };
      }
      if (key === DYNAMO_KEYS.AGENT_TOOL_OVERRIDES) {
        return {
          'WS#default#agent1': ['WS#default#toolA', 'toolB'], // toolA in batch overrides
        };
      }
      if (key === 'WS#default#agent1_tools') {
        return ['WS#default#toolA', 'toolC']; // toolA also in per-agent legacy list
      }
      return undefined;
    });

    const prunedCount = await AgentRegistry.pruneLowUtilizationTools('default', 30);

    // Should prune from both
    expect(prunedCount).toBeGreaterThan(0);

    // VERIFY: Legacy list is UPDATED (using saveRawConfig as they are simple keys)
    const saveCalls = vi.mocked(ConfigManager.saveRawConfig).mock.calls;
    const legacySave = saveCalls.find((call) => call[0] === 'WS#default#agent1_tools');
    expect(legacySave).toBeDefined();
    expect(legacySave![1] as string[]).not.toContain('WS#default#toolA');
    expect(legacySave![1] as string[]).toContain('toolC');

    // VERIFY: Batch overrides are pruned ATOMICALLY via ConfigManager
    expect(ConfigManager.atomicRemoveFromMap).toHaveBeenCalledWith(
      DYNAMO_KEYS.AGENT_TOOL_OVERRIDES,
      'WS#default#agent1',
      ['WS#default#toolA']
    );
  });

  it('should respect grace periods for newly assigned tools', async () => {
    const now = Date.now();

    // toolB was just registered (now)
    vi.mocked(ConfigManager.getRawConfig).mockImplementation(async (key) => {
      if (key === DYNAMO_KEYS.TOOL_USAGE) {
        return {
          'WS#default#toolB': { count: 0, firstRegistered: now },
        };
      }
      if (key === DYNAMO_KEYS.AGENTS_CONFIG) {
        return {
          'WS#default#agent1': { name: 'Agent 1', tools: ['WS#default#toolB'] },
        };
      }
      return undefined;
    });

    const prunedCount = await AgentRegistry.pruneLowUtilizationTools('default', 30);
    expect(prunedCount).toBe(0);
    expect(ConfigManager.saveRawConfig).not.toHaveBeenCalled();
  });
});
