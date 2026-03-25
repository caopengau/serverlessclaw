import { z } from 'zod';
import { AgentStatus, AgentType } from '../types/agent';

/**
 * Standardized Orchestration Signal Schema.
 * Used by Initiator agents (SuperClaw, Planner) to communicate high-level
 * decisions after being consulted by sub-agents or system events.
 */
export const OrchestrationSignalSchema = z
  .object({
    /**
     * High-level operational decision.
     * - SUCCESS: Goal achieved.
     * - FAILED: Goal unreachable.
     * - RETRY: Re-dispatch to the same agent with refinements.
     * - PIVOT: Delegate to a different agent/strategy.
     * - ESCALATE: Stop and wait for human input.
     */
    status: z.nativeEnum(AgentStatus),

    /** Inner monologue or reasoning steps explaining the decision. */
    reasoning: z.string().min(1, 'Reasoning is required for all orchestration decisions.'),

    /**
     * Clear, actionable instructions for the next step.
     * If status is RETRY or PIVOT, this is the task for the next agent.
     * If status is ESCALATE, this is the question for the human.
     */
    nextStep: z.string().optional(),

    /**
     * The ID of the agent to delegate to.
     * Required if status is PIVOT.
     */
    targetAgentId: z.nativeEnum(AgentType).optional(),

    /**
     * Additional data to pass to the next agent or human.
     */
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .strict();

/** Type inference for the Orchestration Signal. */
export type OrchestrationSignal = z.infer<typeof OrchestrationSignalSchema>;
