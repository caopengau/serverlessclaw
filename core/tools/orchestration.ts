import { orchestrationTools } from './definitions/orchestration';
import { logger } from '../lib/logger';
import { AgentStatus, AgentType } from '../lib/types/agent';
import { formatErrorMessage } from '../lib/utils/error';

/**
 * Triggers batch evolution for multiple gaps by dispatching them to the Coder agent.
 */
export const TRIGGER_BATCH_EVOLUTION = {
  ...orchestrationTools.triggerBatchEvolution,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { gapIds } = args as { gapIds: string[] };

    if (!gapIds || gapIds.length === 0) {
      return 'FAILED: At least one gapId is required.';
    }

    try {
      const { DynamoMemory } = await import('../lib/memory');
      const { emitEvent } = await import('../lib/utils/bus');
      const memory = new DynamoMemory();

      const results: string[] = [];
      for (const gapId of gapIds) {
        const numericId = gapId.includes('#') ? gapId.split('#')[1] : gapId;
        const fullGapId = gapId.includes('#') ? gapId : `GAP#${numericId}`;

        try {
          const plan = await memory.getDistilledMemory(`PLAN#${numericId}`);
          if (plan) {
            await emitEvent('tool.batchEvolution', 'coder_task', {
              userId: 'SYSTEM#GLOBAL',
              task: plan,
              metadata: { gapIds: [fullGapId] },
              source: 'batch_evolution',
            });
            await memory.updateGapStatus(fullGapId, 'PROGRESS' as never);
            results.push(`- ${fullGapId}: dispatched to Coder`);
          } else {
            results.push(`- ${fullGapId}: SKIPPED (no plan found)`);
          }
        } catch (gapError) {
          results.push(`- ${fullGapId}: ERROR (${formatErrorMessage(gapError)})`);
        }
      }

      return `Batch evolution complete for ${gapIds.length} gaps:\n${results.join('\n')}`;
    } catch (error) {
      return `Failed to trigger batch evolution: ${formatErrorMessage(error)}`;
    }
  },
};

/**
 * Executes a high-level orchestration signal to decide the next step in a task lifecycle.
 * This tool is primarily used by Initiator agents (SuperClaw, Planner) to maintain
 * goal-directed behavior when sub-agents complete or fail tasks.
 */
export const SIGNAL_ORCHESTRATION = {
  ...orchestrationTools.signalOrchestration,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { status, reasoning, nextStep, targetAgentId } = args as {
      status: AgentStatus;
      reasoning: string;
      nextStep?: string;
      targetAgentId?: AgentType;
    };

    logger.info(`[ORCHESTRATION] Emitting Signal: ${status} | Target: ${targetAgentId ?? 'N/A'}`);
    logger.info(`[ORCHESTRATION] Reasoning: ${reasoning}`);

    // This tool is primarily a structured signal for the agent's reasoning.
    // The EventHandler (task-result-handler) typically catches completion results,
    // but when an Initiator calls this tool, it's an explicit "task closure" or "pivot."

    let report = `ORCHESTRATION_SIGNAL_EMITTED: ${status}.\n\nReasoning: ${reasoning}`;
    if (nextStep) report += `\n\nNext Step: ${nextStep}`;
    if (targetAgentId) report += `\nTarget Agent: ${targetAgentId}`;

    return report;
  },
};
