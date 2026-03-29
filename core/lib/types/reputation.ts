/**
 * @module ReputationTypes
 * Defines the schema for agent reputation tracking and updates.
 */

/**
 * Agent reputation data for routing and consensus.
 */
export interface AgentReputation {
  /** Unique ID of the agent. */
  agentId: string;
  /** Number of tasks successfully completed. */
  tasksCompleted: number;
  /** Number of tasks that failed. */
  tasksFailed: number;
  /** Average latency in milliseconds for task completion. */
  avgLatencyMs: number;
  /** Success rate (0.0 to 1.0). */
  successRate: number;
  /** Total number of tasks processed. */
  totalTasks: number;
  /** Timestamp of the last active task. */
  lastActive: number;
  /** Rolling window in days for reputation calculation (e.g., 7). */
  rollingWindow: number;
  /** Composite reputation score (0.0 to 1.0). */
  score: number;
  /** Optional metadata about failure patterns. */
  failurePatterns?: string[];
}

/**
 * Data needed to update an agent's reputation.
 */
export interface ReputationUpdatePayload {
  /** The ID of the agent whose reputation is being updated. */
  agentId: string;
  /** Whether the task was successful. */
  success: boolean;
  /** Duration of the task in milliseconds. */
  durationMs: number;
  /** Optional error message if the task failed. */
  error?: string;
  /** Optional context about the task complexity. */
  taskComplexity?: number;
}
