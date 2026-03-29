/**
 * Reputation Operations Module
 *
 * Manages agent reputation data for swarm-aware routing decisions.
 * Tracks rolling 7-day performance metrics per agent: tasks completed/failed,
 * average latency, success rate, and last active timestamp.
 *
 * These functions operate on a BaseMemoryProvider instance.
 */

import { logger } from '../logger';
import { TIME, MEMORY_KEYS } from '../constants';
import type { BaseMemoryProvider } from './base';

/**
 * Rolling window for reputation metrics (7 days in milliseconds).
 */
const REPUTATION_WINDOW_MS = 7 * TIME.MS_PER_DAY;

/**
 * Reputation data stored per agent.
 */
export interface AgentReputation {
  /** The agent identifier. */
  agentId: string;
  /** Total tasks completed successfully in the rolling window. */
  tasksCompleted: number;
  /** Total tasks failed in the rolling window. */
  tasksFailed: number;
  /** Cumulative latency of completed tasks (ms) for average calculation. */
  totalLatencyMs: number;
  /** Computed success rate: tasksCompleted / (tasksCompleted + tasksFailed). */
  successRate: number;
  /** Computed average latency: totalLatencyMs / tasksCompleted. */
  avgLatencyMs: number;
  /** Timestamp of last task completion or failure. */
  lastActive: number;
  /** Start of the current rolling window. */
  windowStart: number;
  /** Epoch second for DynamoDB TTL. */
  expiresAt: number;
}

/**
 * Resolves the DynamoDB partition key for a reputation record.
 */
function reputationKey(agentId: string): string {
  return `${MEMORY_KEYS.REPUTATION_PREFIX}${agentId}`;
}

/**
 * Retrieves the current reputation for an agent.
 *
 * @param base - The base memory provider instance.
 * @param agentId - The agent to look up.
 * @returns The agent's reputation, or null if no record exists.
 */
export async function getReputation(
  base: BaseMemoryProvider,
  agentId: string
): Promise<AgentReputation | null> {
  try {
    const items = await base.queryItems({
      KeyConditionExpression: 'userId = :pk AND #ts = :zero',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: {
        ':pk': reputationKey(agentId),
        ':zero': 0,
      },
    });

    if (items.length === 0) return null;

    const item = items[0];
    return {
      agentId: item.agentId as string,
      tasksCompleted: (item.tasksCompleted as number) ?? 0,
      tasksFailed: (item.tasksFailed as number) ?? 0,
      totalLatencyMs: (item.totalLatencyMs as number) ?? 0,
      successRate: (item.successRate as number) ?? 0,
      avgLatencyMs: (item.avgLatencyMs as number) ?? 0,
      lastActive: (item.lastActive as number) ?? 0,
      windowStart: (item.windowStart as number) ?? Date.now(),
      expiresAt: (item.expiresAt as number) ?? 0,
    };
  } catch (error) {
    logger.error(`Failed to get reputation for ${agentId}:`, error);
    return null;
  }
}

/**
 * Updates agent reputation on task completion or failure.
 * Implements rolling window reset: if the window has expired, counters reset.
 *
 * @param base - The base memory provider instance.
 * @param agentId - The agent whose reputation to update.
 * @param success - Whether the task succeeded.
 * @param latencyMs - Duration of the task in milliseconds.
 */
export async function updateReputation(
  base: BaseMemoryProvider,
  agentId: string,
  success: boolean,
  latencyMs: number = 0
): Promise<void> {
  const now = Date.now();
  const existing = await getReputation(base, agentId);

  let tasksCompleted: number;
  let tasksFailed: number;
  let totalLatencyMs: number;
  let windowStart: number;

  if (existing && now - existing.windowStart < REPUTATION_WINDOW_MS) {
    // Within rolling window — accumulate
    tasksCompleted = existing.tasksCompleted + (success ? 1 : 0);
    tasksFailed = existing.tasksFailed + (success ? 0 : 1);
    totalLatencyMs = existing.totalLatencyMs + (success ? latencyMs : 0);
    windowStart = existing.windowStart;
  } else {
    // Window expired or first record — start fresh
    tasksCompleted = success ? 1 : 0;
    tasksFailed = success ? 0 : 1;
    totalLatencyMs = success ? latencyMs : 0;
    windowStart = now;
  }

  const total = tasksCompleted + tasksFailed;
  const successRate = total > 0 ? tasksCompleted / total : 0;
  const avgLatencyMs = tasksCompleted > 0 ? totalLatencyMs / tasksCompleted : 0;
  const expiresAt = Math.floor((now + REPUTATION_WINDOW_MS) / 1000);

  try {
    await base.putItem({
      userId: reputationKey(agentId),
      timestamp: 0,
      type: 'REPUTATION',
      agentId,
      tasksCompleted,
      tasksFailed,
      totalLatencyMs,
      successRate,
      avgLatencyMs,
      lastActive: now,
      windowStart,
      expiresAt,
      createdAt: existing?.windowStart ?? now,
    });

    logger.info(
      `[Reputation] Updated ${agentId}: success=${success}, rate=${successRate.toFixed(2)}, ` +
        `completed=${tasksCompleted}, failed=${tasksFailed}, avgLatency=${avgLatencyMs.toFixed(0)}ms`
    );
  } catch (error) {
    logger.error(`Failed to update reputation for ${agentId}:`, error);
  }
}

/**
 * Retrieves reputations for multiple agents in a single batch.
 *
 * @param base - The base memory provider instance.
 * @param agentIds - The agent IDs to look up.
 * @returns A map of agentId to AgentReputation (missing entries are excluded).
 */
export async function getReputations(
  base: BaseMemoryProvider,
  agentIds: string[]
): Promise<Map<string, AgentReputation>> {
  const results = new Map<string, AgentReputation>();
  const promises = agentIds.map(async (id) => {
    const rep = await getReputation(base, id);
    if (rep) results.set(id, rep);
  });
  await Promise.all(promises);
  return results;
}

/**
 * Computes a composite reputation score (0-1) suitable for routing decisions.
 * Weights: 60% success rate, 25% latency (inverted), 15% recency.
 *
 * @param reputation - The agent's reputation data.
 * @returns A score from 0 (worst) to 1 (best).
 */
export function computeReputationScore(reputation: AgentReputation): number {
  const now = Date.now();

  // Success rate component (0-1)
  const successComponent = reputation.successRate;

  // Latency component: normalized to 0-1 (lower is better, 5s baseline)
  const baselineLatency = 5000;
  const latencyComponent = Math.max(0, 1 - reputation.avgLatencyMs / (baselineLatency * 3));

  // Recency component: decays over 24 hours
  const hoursSinceActive = (now - reputation.lastActive) / TIME.MS_PER_HOUR;
  const recencyComponent = Math.max(0, 1 - hoursSinceActive / 24);

  return successComponent * 0.6 + latencyComponent * 0.25 + recencyComponent * 0.15;
}
