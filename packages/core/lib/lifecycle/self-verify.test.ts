import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelfVerifier } from './self-verify';
import { GapStatus } from '../types/index';
import { DYNAMO_KEYS } from '../constants/system';

// Mock SST
vi.mock('sst', () => ({
  Resource: {
    MemoryTable: { name: 'test-memory' },
    ConfigTable: { name: 'test-config' },
  },
}));

const { mockSend, mockRunDeepHealthCheck } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockRunDeepHealthCheck: vi.fn(),
}));

const { mockGetTypedConfig, mockGetDeployCountToday } = vi.hoisted(() => ({
  mockGetTypedConfig: vi.fn(),
  mockGetDeployCountToday: vi.fn(),
}));

const { mockDiscoverSystemTopology } = vi.hoisted(() => ({
  mockDiscoverSystemTopology: vi.fn(),
}));

vi.mock('./health', () => ({
  runDeepHealthCheck: mockRunDeepHealthCheck,
}));

vi.mock('../registry/config', () => ({
  ConfigManager: {
    getTypedConfig: mockGetTypedConfig,
  },
}));

vi.mock('../metrics/deploy-stats', () => ({
  getDeployCountToday: mockGetDeployCountToday,
}));

vi.mock('../utils/topology', () => ({
  discoverSystemTopology: mockDiscoverSystemTopology,
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: () => ({
      send: mockSend,
    }),
  },
  GetCommand: class {
    constructor(public input: unknown) {}
  },
  ScanCommand: class {
    constructor(public input: unknown) {}
  },
  QueryCommand: class {
    constructor(public input: unknown) {}
  },
}));

describe('SelfVerifier', () => {
  let verifier: SelfVerifier;

  beforeEach(() => {
    vi.clearAllMocks();
    verifier = new SelfVerifier();
  });

  describe('verifyEvolution', () => {
    it('should calculate gap statistics correctly', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { userId: 'GAP#1', type: 'GAP', status: GapStatus.OPEN },
          { userId: 'WS#default#GAP#2', type: 'GAP', status: GapStatus.PROGRESS },
          { userId: 'GAP#3', type: 'GAP', status: GapStatus.DONE },
          { userId: 'GAP#4', type: 'GAP', status: GapStatus.DONE },
          { userId: 'GAP#5', type: 'GAP', status: GapStatus.FAILED },
          { userId: 'GAP#6', type: 'GAP', status: GapStatus.FAILED },
        ],
      });

      const result = await verifier.verifyEvolution();

      expect(result.totalGaps).toBe(6);
      expect(result.activeGaps).toBe(2);
      expect(result.fixSuccessRate).toBe(50);
    });

    it('should handle zero gaps gracefully', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      const result = await verifier.verifyEvolution();
      expect(result.totalGaps).toBe(0);
      expect(result.fixSuccessRate).toBe(100);
    });
  });

  describe('verifyResilience', () => {
    it('should detect active circuit breaker using config limit', async () => {
      // 1. Mock Config (limit: 3)
      mockGetTypedConfig.mockResolvedValueOnce(3);
      // 2. Mock Stats (count: 3)
      mockGetDeployCountToday.mockResolvedValueOnce(3);
      // 3. Mock Deep Health
      mockRunDeepHealthCheck.mockResolvedValueOnce({ ok: true });

      const result = await verifier.verifyResilience();

      expect(result.deployCountToday).toBe(3);
      expect(result.circuitBreakerActive).toBe(true);
      expect(result.apiHealthy).toBe(true);
    });

    it('should respect default limit if config is missing', async () => {
      // 1. Mock Config fallback to default in ConfigManager
      mockGetTypedConfig.mockResolvedValueOnce(5);
      // 2. Mock Stats (count: 2)
      mockGetDeployCountToday.mockResolvedValueOnce(2);
      // 3. Mock Deep Health (failed)
      mockRunDeepHealthCheck.mockResolvedValueOnce({ ok: false });

      const result = await verifier.verifyResilience();

      expect(result.deployCountToday).toBe(2);
      expect(result.circuitBreakerActive).toBe(false); // default 5
      expect(result.apiHealthy).toBe(false);
    });
  });

  describe('verifyAwareness', () => {
    it('should calculate registry coverage correctly', async () => {
      // 1. Mock topology config
      mockGetTypedConfig.mockImplementation(async (key: string) => {
        if (key === DYNAMO_KEYS.SYSTEM_TOPOLOGY) {
          return {
            nodes: [
              { id: 'sc', type: 'agent' },
              { id: 'ca', type: 'agent' },
              { id: 'db', type: 'infra' },
            ],
            updatedAt: '2026-03-15T10:00:00Z',
          };
        }
        if (key === DYNAMO_KEYS.AGENTS_CONFIG) {
          return {
            superclaw: { id: 'superclaw' },
            coder: { id: 'coder' },
            watcher: { id: 'watcher' },
          };
        }
        return {};
      });

      const result = await verifier.verifyAwareness();

      expect(result.nodeCount).toBe(3);
      expect(result.registryCoverage).toBeCloseTo(66.66, 1);
      expect(result.lastScanTimestamp).toBe('2026-03-15T10:00:00Z');
    });

    it('should fallback to live topology discovery when cached topology is empty', async () => {
      mockGetTypedConfig.mockImplementation(async (key: string) => {
        if (key === DYNAMO_KEYS.SYSTEM_TOPOLOGY) {
          return { nodes: [], edges: [], updatedAt: undefined };
        }
        if (key === DYNAMO_KEYS.AGENTS_CONFIG) {
          return {
            superclaw: { id: 'superclaw' },
            coder: { id: 'coder' },
          };
        }
        return {};
      });
      mockDiscoverSystemTopology.mockResolvedValueOnce({
        nodes: [
          { id: 'sc', type: 'agent' },
          { id: 'db', type: 'infra' },
        ],
        edges: [],
        updatedAt: '2026-03-16T10:00:00Z',
      });

      const result = await verifier.verifyAwareness();

      expect(result.nodeCount).toBe(2);
      expect(result.registryCoverage).toBe(50);
      expect(result.lastScanTimestamp).toBe('2026-03-16T10:00:00Z');
    });
  });
});
