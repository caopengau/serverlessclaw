import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NODE_TYPE, NODE_TIER, NODE_ICON, INFRA_NODE_ID } from './constants';

vi.mock('fs', () => {
  const mockReadFileSync = vi.fn();
  const mockExistsSync = vi.fn();
  return {
    __esModule: true,
    default: { readFileSync: mockReadFileSync, existsSync: mockExistsSync },
    readFileSync: mockReadFileSync,
    existsSync: mockExistsSync,
  };
});

vi.mock('@aws-sdk/client-dynamodb', () => {
  const mockSend = vi.fn().mockResolvedValue({ TableNames: ['serverlessclaw-local-MemoryTable'] });
  const mockDynamoDBClient = vi.fn().mockImplementation(function () {
    return { send: mockSend };
  });
  return {
    __esModule: true,
    default: { DynamoDBClient: mockDynamoDBClient, ListTablesCommand: vi.fn() },
    DynamoDBClient: mockDynamoDBClient,
    ListTablesCommand: vi.fn(),
  };
});

vi.mock('@aws-sdk/client-s3', () => {
  const mockSend = vi
    .fn()
    .mockResolvedValue({ Buckets: [{ Name: 'serverlessclaw-local-KnowledgeBucket' }] });
  const mockS3Client = vi.fn().mockImplementation(function () {
    return { send: mockSend };
  });
  return {
    __esModule: true,
    default: { S3Client: mockS3Client, ListBucketsCommand: vi.fn() },
    S3Client: mockS3Client,
    ListBucketsCommand: vi.fn(),
  };
});

vi.mock('@aws-sdk/client-lambda', () => {
  const mockSend = vi.fn().mockResolvedValue({
    Functions: [{ FunctionName: 'serverlessclaw-local-agent-runner' }],
  });
  const mockLambdaClient = vi.fn().mockImplementation(function () {
    return { send: mockSend };
  });
  return {
    __esModule: true,
    default: { LambdaClient: mockLambdaClient, ListFunctionsCommand: vi.fn() },
    LambdaClient: mockLambdaClient,
    ListFunctionsCommand: vi.fn(),
  };
});

vi.mock('../../backbone', () => ({
  BACKBONE_REGISTRY: {
    superclaw: {
      id: 'superclaw',
      name: 'SuperClaw',
      description: 'Orchestrator',
      enabled: true,
      isBackbone: true,
      tools: ['dispatchTask'],
      connectionProfile: ['bus', 'memory'],
    },
    coder: {
      id: 'coder',
      name: 'Coder Agent',
      description: 'Builder',
      enabled: true,
      isBackbone: true,
      tools: ['runTests'],
      connectionProfile: ['bus', 'memory'],
    },
    reflector: {
      id: 'reflector',
      name: 'Cognition Reflector',
      description: 'Audit node',
      enabled: true,
      isBackbone: true,
      tools: ['recallKnowledge'],
      connectionProfile: ['bus'],
    },
    eventhandler: {
      id: 'eventhandler',
      name: 'Event Handler',
      agentType: 'logic',
      description: 'Logic Handler',
      enabled: true,
      isBackbone: true,
      connectionProfile: ['memory'],
    },
  },
}));

import {
  ORPHAN_NODES,
  discoverSstNodes,
  addOrphanNodes,
  mergeBackboneNodes,
  addDynamicAgents,
  discoverAwsNodes,
} from './nodes';

describe('ORPHAN_NODES', () => {
  it('contains the expected number of orphan nodes', () => {
    expect(ORPHAN_NODES.length).toBe(8);
  });

  it('includes dashboard node', () => {
    const dashboard = ORPHAN_NODES.find((n) => n.id === INFRA_NODE_ID.DASHBOARD);
    expect(dashboard).toBeDefined();
    expect(dashboard?.type).toBe(NODE_TYPE.DASHBOARD);
    expect(dashboard?.tier).toBe(NODE_TIER.APP);
  });

  it('includes scheduler node', () => {
    const scheduler = ORPHAN_NODES.find((n) => n.id === INFRA_NODE_ID.SCHEDULER);
    expect(scheduler).toBeDefined();
    expect(scheduler?.type).toBe(NODE_TYPE.INFRA);
    expect(scheduler?.icon).toBe(NODE_ICON.CALENDAR);
    expect(scheduler?.tier).toBe(NODE_TIER.APP);
  });

  it('includes telegram node', () => {
    const telegram = ORPHAN_NODES.find((n) => n.id === INFRA_NODE_ID.TELEGRAM);
    expect(telegram).toBeDefined();
    expect(telegram?.icon).toBe(NODE_ICON.SEND);
    expect(telegram?.tier).toBe(NODE_TIER.APP);
  });

  it('includes heartbeat node', () => {
    const heartbeat = ORPHAN_NODES.find((n) => n.id === INFRA_NODE_ID.HEARTBEAT);
    expect(heartbeat).toBeDefined();
    expect(heartbeat?.tier).toBe(NODE_TIER.GATEWAY);
  });

  it('includes realtime bridge node', () => {
    const bridge = ORPHAN_NODES.find((n) => n.id === INFRA_NODE_ID.REALTIME_BRIDGE);
    expect(bridge).toBeDefined();
    expect(bridge?.tier).toBe(NODE_TIER.COMM);
  });

  it('includes realtime bus node', () => {
    const bus = ORPHAN_NODES.find((n) => n.id === INFRA_NODE_ID.REALTIME_BUS);
    expect(bus).toBeDefined();
    expect(bus?.icon).toBe(NODE_ICON.RADIO);
    expect(bus?.tier).toBe(NODE_TIER.GATEWAY);
  });
});

describe('discoverSstNodes', () => {
  it('returns an empty array for empty resource map', () => {
    expect(discoverSstNodes({})).toEqual([]);
  });

  it('filters out null/undefined/non-object values', () => {
    const result = discoverSstNodes({
      validResource: { name: 'test' },
      nullResource: null,
      undefinedResource: undefined,
      stringResource: 'not-an-object',
      numberResource: 42,
    });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('validresource');
  });

  it('filters out sensitive keys', () => {
    const result = discoverSstNodes({
      App: { name: 'test' },
      token: { name: 'secret' },
      myKey: { name: 'key-val' },
      password: { name: 'pw' },
      secretVal: { name: 'secret' },
      awsRegion: { name: 'us-east-1' },
      activeModel: { name: 'gpt' },
      activeProvider: { name: 'openai' },
      validResource: { name: 'test' },
    });
    // App, token, password, secretVal, awsRegion, activeModel, activeProvider are filtered.
    // myKey and validResource are kept.
    expect(result.length).toBe(2);
    expect(result.map((n) => n.id)).toContain('validresource');
    expect(result.map((n) => n.id)).toContain('mykey');
  });

  it('lowercases resource keys for node IDs', () => {
    const result = discoverSstNodes({
      MyResource: { name: 'test' },
    });
    expect(result[0].id).toBe('myresource');
  });

  it('uses classifier info when available', () => {
    const result = discoverSstNodes({
      memorytable: { name: 'test' },
    });
    expect(result[0].type).toBe(NODE_TYPE.INFRA);
    expect(result[0].icon).toBe(NODE_ICON.DATABASE);
    expect(result[0].label).toBe('ClawDB (Single Table)');
    expect(result[0].isBackbone).toBe(true);
  });

  it('uses defaults for unrecognized resources', () => {
    const result = discoverSstNodes({
      unknownResource: { name: 'test' },
    });
    expect(result[0].type).toBe(NODE_TYPE.INFRA);
    expect(result[0].icon).toBe(NODE_ICON.DATABASE);
    expect(result[0].label).toBe('unknownResource');
    expect(result[0].tier).toBe(NODE_TIER.INFRA);
  });

  it('promotes superclaw to GATEWAY tier regardless of classifier', () => {
    const result = discoverSstNodes({
      superclaw: { name: 'test' },
    });
    expect(result[0].tier).toBe(NODE_TIER.GATEWAY);
  });

  it('uses idOverride from classifier when present', () => {
    const result = discoverSstNodes({
      clawcenter: { name: 'test' },
    });
    expect(result[0].id).toBe('dashboard');
  });

  it('marks all nodes as backbone', () => {
    const result = discoverSstNodes({
      someresource: { name: 'test' },
    });
    expect(result[0].isBackbone).toBe(true);
  });
});

describe('addOrphanNodes', () => {
  it('adds all orphan nodes to an empty list', () => {
    const result = addOrphanNodes([]);
    expect(result.length).toBe(ORPHAN_NODES.length);
  });

  it('does not duplicate existing orphan nodes', () => {
    const existing = [
      {
        id: INFRA_NODE_ID.DASHBOARD,
        type: NODE_TYPE.DASHBOARD,
        label: 'Dashboard',
      },
    ];
    const result = addOrphanNodes(existing);
    expect(result.length).toBe(existing.length + ORPHAN_NODES.length - 1);
    expect(result.filter((n) => n.id === INFRA_NODE_ID.DASHBOARD).length).toBe(1);
  });

  it('preserves existing nodes', () => {
    const existing = [
      {
        id: 'myagent',
        type: NODE_TYPE.AGENT,
        label: 'My Agent',
      },
    ];
    const result = addOrphanNodes(existing);
    expect(result.find((n) => n.id === 'myagent')).toBeDefined();
  });

  it('does not mutate the original array', () => {
    const existing = [
      {
        id: 'myagent',
        type: NODE_TYPE.AGENT,
        label: 'My Agent',
      },
    ];
    const originalLength = existing.length;
    addOrphanNodes(existing);
    expect(existing.length).toBe(originalLength);
  });
});

describe('mergeBackboneNodes', () => {
  it('enriches existing nodes with backbone metadata', () => {
    const existing = [
      {
        id: 'superclaw',
        type: NODE_TYPE.AGENT,
        label: 'Old Label',
        icon: NODE_ICON.BOT,
        tier: NODE_TIER.AGENT,
      },
    ];
    const result = mergeBackboneNodes(existing);
    const superclaw = result.find((n) => n.id === 'superclaw');
    expect(superclaw?.label).toBe('SuperClaw');
    expect(superclaw?.description).toBe('Orchestrator');
    expect(superclaw?.tier).toBe(NODE_TIER.GATEWAY);
  });

  it('adds new backbone nodes not already in list', () => {
    const existing = [
      {
        id: 'superclaw',
        type: NODE_TYPE.AGENT,
        label: 'SuperClaw',
      },
    ];
    const result = mergeBackboneNodes(existing);
    const coder = result.find((n) => n.id === 'coder');
    expect(coder).toBeDefined();
    expect(coder?.type).toBe(NODE_TYPE.AGENT);
    expect(coder?.label).toBe('Coder Agent');
    expect(coder?.description).toBe('Builder');
  });

  it('sets superclaw tier to GATEWAY when added as new node', () => {
    const result = mergeBackboneNodes([]);
    const superclaw = result.find((n) => n.id === 'superclaw');
    expect(superclaw?.tier).toBe(NODE_TIER.GATEWAY);
  });

  it('sets non-superclaw backbone agents to AGENT tier', () => {
    const result = mergeBackboneNodes([]);
    const coder = result.find((n) => n.id === 'coder');
    expect(coder?.tier).toBe(NODE_TIER.AGENT);
  });

  it('uses BRAIN icon for backbone agents', () => {
    const result = mergeBackboneNodes([]);
    const coder = result.find((n) => n.id === 'coder');
    expect(coder?.icon).toBe(NODE_ICON.BRAIN);
  });

  it('sets logic handlers to UTILITY tier and INFRA type', () => {
    const result = mergeBackboneNodes([]);
    const handler = result.find((n) => n.id === 'eventhandler');
    expect(handler).toBeDefined();
    expect(handler?.tier).toBe(NODE_TIER.UTILITY);
    expect(handler?.type).toBe(NODE_TYPE.INFRA);
  });

  it('does not mutate the original array', () => {
    const existing = [
      {
        id: 'superclaw',
        type: NODE_TYPE.AGENT,
        label: 'SuperClaw',
      },
    ];
    const originalLength = existing.length;
    mergeBackboneNodes(existing);
    expect(existing.length).toBe(originalLength);
  });
});

describe('addDynamicAgents', () => {
  it('adds agents from database items', () => {
    const existing = [
      {
        id: 'superclaw',
        type: NODE_TYPE.AGENT,
        label: 'SuperClaw',
      },
    ];
    const items = [
      {
        config: {
          M: {
            id: 'dynamic-agent-1',
            name: 'Dynamic Agent',
            enabled: true,
          },
        },
      },
    ];
    const result = addDynamicAgents(existing, items);
    const dynamic = result.find((n) => n.id === 'dynamic-agent-1');
    expect(dynamic).toBeDefined();
    expect(dynamic?.type).toBe(NODE_TYPE.AGENT);
    expect(dynamic?.label).toBe('Dynamic Agent');
    expect(dynamic?.tier).toBe(NODE_TIER.AGENT);
  });

  it('handles logic agents in database items', () => {
    const items = [
      {
        config: {
          M: {
            id: 'logic-handler',
            name: 'Logic Handler',
            agentType: 'logic',
            enabled: true,
          },
        },
      },
    ];
    const result = addDynamicAgents([], items);
    const logic = result.find((n) => n.id === 'logic-handler');
    expect(logic?.type).toBe(NODE_TYPE.INFRA);
    expect(logic?.tier).toBe(NODE_TIER.UTILITY);
  });
});

describe('discoverAwsNodes', () => {
  beforeEach(() => {
    process.env.SST_APP = 'serverlessclaw';
    process.env.SST_STAGE = 'local';
    process.env.AWS_REGION = 'ap-southeast-2';
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.SST_APP;
    delete process.env.SST_STAGE;
    delete process.env.AWS_REGION;
  });

  it('discovers nodes from AWS services', async () => {
    const result = await discoverAwsNodes();

    expect(result.some((n) => n.id === 'clawdb')).toBe(true);
    expect(result.some((n) => n.id === 'knowledgebucket')).toBe(true);
    expect(result.some((n) => n.id === 'agent-runner')).toBe(true);
  });
});
