import { IToolDefinition } from '../../lib/types/index';
import { AgentStatus, AgentType } from '../../lib/types/agent';

/**
 * Orchestration tool definitions for high-level agent coordination.
 */
export const orchestrationTools: Record<string, IToolDefinition> = {
  triggerBatchEvolution: {
    name: 'triggerBatchEvolution',
    description:
      'Triggers evolution for multiple capability gaps at once by dispatching them to the Coder agent.',
    parameters: {
      type: 'object',
      properties: {
        gapIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of gap IDs to evolve (e.g., ["1712345678", "1712345679"]).',
        },
      },
      required: ['gapIds'],
      additionalProperties: false,
    },
    connectionProfile: ['bus'],
  },
  signalOrchestration: {
    name: 'signalOrchestration',
    description:
      'Emits a high-level orchestration signal to decide the next step in a task lifecycle. Use this to RETRY a failed task, PIVOT to a new agent/strategy, ESCALATE to a human, or finalize with SUCCESS/FAILED.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: [
            AgentStatus.SUCCESS,
            AgentStatus.FAILED,
            AgentStatus.RETRY,
            AgentStatus.PIVOT,
            AgentStatus.ESCALATE,
          ],
          description: 'The operational decision.',
        },
        reasoning: {
          type: 'string',
          description: 'The logic behind this decision.',
        },
        nextStep: {
          type: 'string',
          description: 'Actionable instructions for the next agent or question for the human.',
        },
        targetAgentId: {
          type: 'string',
          enum: Object.values(AgentType),
          description: 'The agent to delegate to (required for PIVOT).',
        },
      },
      required: ['status', 'reasoning', 'nextStep', 'targetAgentId'],
      additionalProperties: false,
    },
  },
  requestConsensus: {
    name: 'requestConsensus',
    description:
      'Requests swarm consensus from multiple agents on a proposal. Supports three modes: ' +
      'majority (>50% approval), unanimous (100% approval), and weighted (weighted sum >50%).',
    parameters: {
      type: 'object',
      properties: {
        proposal: {
          type: 'string',
          description: 'The proposal or decision to vote on.',
        },
        voterIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of agent IDs to participate in the vote.',
        },
        mode: {
          type: 'string',
          enum: ['majority', 'unanimous', 'weighted'],
          description: 'Consensus mode. Default: majority.',
        },
        timeoutMs: {
          type: 'number',
          description: 'Timeout in milliseconds for collecting all votes. Default: 60000.',
        },
      },
      required: ['proposal', 'voterIds'],
      additionalProperties: false,
    },
    connectionProfile: ['bus'],
  },
};
