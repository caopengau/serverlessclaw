import { z } from 'zod';
import { AgentStatus, AgentRole } from './agent';

/**
 * Mission Status
 */
export enum MissionStatus {
  PENDING = 'pending',
  PLANNING = 'planning',
  EXECUTING = 'executing',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * A single step in a mission.
 */
export const MissionStepSchema = z.object({
  id: z.string(),
  task: z.string(),
  agentId: z.string() as z.ZodType<AgentRole>,
  status: z.nativeEnum(AgentStatus),
  dependencies: z.array(z.string()),
  result: z.any().optional(),
  error: z.string().optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
});

export type MissionStep = z.infer<typeof MissionStepSchema>;

/**
 * Configuration options for creating a mission.
 */
export interface MissionOptions {
  /** Optional metadata to attach to the mission */
  metadata?: Record<string, unknown>;
  /** Maximum number of sub-tasks to generate during planning */
  maxSteps?: number;
}

/**
 * A high-level Mission.
 */
export const MissionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  intent: z.string(),
  status: z.nativeEnum(MissionStatus),
  steps: z.array(MissionStepSchema),
  context: z.record(z.string(), z.any()),
  createdAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type Mission = z.infer<typeof MissionSchema>;
