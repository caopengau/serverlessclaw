import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SelfVerificationStatus } from '../types/system';
import { GapStatus } from '../types/index';
import { runDeepHealthCheck } from './health';
import { ConfigManager } from '../registry/config';
import { DYNAMO_KEYS, SYSTEM } from '../constants/system';
import { getDeployCountToday } from '../metrics/deploy-stats';
import { getMemoryTableName, getConfigTableName } from '../utils/ddb-client';

// Default client for backward compatibility - can be overridden via constructor for testing
const defaultDdbClient = new DynamoDBClient({});
const defaultDocClient = DynamoDBDocumentClient.from(defaultDdbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

/**
 * Self-Verification Engine
 *
 * Provides automated health checks for the system's evolution, resilience, and awareness mechanisms.
 * @since 2026-03-19
 */
export class SelfVerifier {
  private readonly docClient: DynamoDBDocumentClient;

  /**
   * Creates a new SelfVerifier instance.
   * @param docClient - Optional DynamoDB Document Client for dependency injection (useful for testing)
   */
  constructor(docClient?: DynamoDBDocumentClient) {
    this.docClient = docClient ?? defaultDocClient;
  }

  /**
   * Performs a comprehensive audit of all "Self" mechanisms.
   */
  async verifyAll(): Promise<SelfVerificationStatus> {
    const [evolution, resilience, awareness] = await Promise.all([
      this.verifyEvolution(),
      this.verifyResilience(),
      this.verifyAwareness(),
    ]);

    return { evolution, resilience, awareness };
  }

  /**
   * Verifies the evolution mechanism by checking gap statistics.
   */
  async verifyEvolution() {
    const memoryTable = getMemoryTableName();

    if (!memoryTable) {
      return { totalGaps: 0, activeGaps: 0, fixSuccessRate: 100 };
    }

    // Scan for all GAPs
    const gapResult = await this.docClient.send(
      new ScanCommand({
        TableName: memoryTable,
        FilterExpression:
          '(begins_with(userId, :gapPrefix) OR begins_with(userId, :workspaceGapPrefix)) AND #type = :gapType',
        ExpressionAttributeNames: {
          '#type': 'type',
        },
        ExpressionAttributeValues: {
          ':gapPrefix': 'GAP#',
          ':workspaceGapPrefix': 'WS#default#GAP#',
          ':gapType': 'GAP',
        },
      })
    );

    const gaps = gapResult.Items ?? [];
    const totalGaps = gaps.length;
    const activeGaps = gaps.filter(
      (g) =>
        g.status === GapStatus.OPEN || g.status === GapStatus.PROGRESS || g.status === 'IN_PROGRESS'
    ).length;
    const doneGaps = gaps.filter((g) => g.status === GapStatus.DONE).length;
    const failedGaps = gaps.filter((g) => g.status === GapStatus.FAILED).length;

    // Success rate explicitly excludes ARCHIVED gaps and relies only on resolved states
    const resolvedCount = doneGaps + failedGaps;
    const fixSuccessRate = resolvedCount > 0 ? (doneGaps / resolvedCount) * 100 : 100;

    return { totalGaps, activeGaps, fixSuccessRate };
  }

  /**
   * Verifies the resilience mechanism by checking circuit breakers and health probes.
   */
  async verifyResilience() {
    if (!getMemoryTableName() || !getConfigTableName()) {
      return {
        circuitBreakerActive: false,
        deployCountToday: 0,
        apiHealthy: false,
      };
    }

    // 1. Get deploy limit from canonical config path
    const deployLimit = await ConfigManager.getTypedConfig<number>(
      DYNAMO_KEYS.DEPLOY_LIMIT,
      SYSTEM.DEFAULT_DEPLOY_LIMIT
    );

    // 2. Check current deploy count using canonical stats key
    const deployCountToday = await getDeployCountToday();
    const circuitBreakerActive = deployCountToday >= deployLimit;

    // 3. Perform Deep Health Check (Non-mocked)
    const healthResult = await runDeepHealthCheck();

    return {
      circuitBreakerActive,
      deployCountToday,
      apiHealthy: healthResult.ok,
    };
  }

  /**
   * Verifies the awareness mechanism by checking topology discovery.
   */
  async verifyAwareness() {
    if (!getConfigTableName()) {
      return {
        nodeCount: 0,
        lastScanTimestamp: undefined,
        registryCoverage: 100,
      };
    }

    // 1. Check discovered topology from canonical config key
    let topo = (await ConfigManager.getTypedConfig(DYNAMO_KEYS.SYSTEM_TOPOLOGY, {
      nodes: [],
      edges: [],
      updatedAt: undefined,
    })) as {
      nodes: Array<{ type: string }>;
      edges: unknown[];
      updatedAt?: string;
    };

    // Fallback to live discovery when topology cache is missing/stale.
    if (!Array.isArray(topo.nodes) || topo.nodes.length === 0) {
      try {
        const { discoverSystemTopology } = await import('../utils/topology');
        topo = await discoverSystemTopology();
      } catch {
        // Keep empty fallback topology; health gate will reflect low awareness.
      }
    }

    const nodeCount = topo.nodes.length;
    const lastScanTimestamp = topo.updatedAt;

    // 2. Compare configured agents in ConfigTable vs agents represented in topology
    const configuredAgents = (await ConfigManager.getTypedConfig(
      DYNAMO_KEYS.AGENTS_CONFIG,
      {}
    )) as Record<string, unknown>;
    const registeredAgentCount = Object.keys(configuredAgents).length;

    const agentsInTopo = topo.nodes.filter((n) => n.type === 'agent').length;

    const registryCoverage =
      registeredAgentCount > 0 ? (agentsInTopo / registeredAgentCount) * 100 : 100;

    return {
      nodeCount,
      lastScanTimestamp,
      registryCoverage: Math.min(registryCoverage, 100),
    };
  }
}
