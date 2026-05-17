import { DYNAMO_KEYS } from '../../constants';
import { ConfigManager } from '../../registry/config';
import { logger } from '../../logger';
import { emitTypedEvent } from '../../utils/typed-emit';
import { EventType } from '../../types/agent';
import { TokenTracker } from '../../metrics/token-usage';
import { CoManagementManager } from '../co-management-manager';
import { ProposalType, ProposalStatus, SwarmProposal, AgentNode } from '../co-management';

interface GovernanceState {
  activeProposals?: Record<
    string,
    {
      agentId: string;
      targetMode: 'AUTO' | 'HITL';
      reason: string;
      trustScore?: number;
      createdAt: number;
      status: 'pending' | 'approved' | 'rejected';
    }
  >;
}

/**
 * Proposes an update to the agent's autonomy mode (EvolutionMode).
 * This is used by SuperClaw to "negotiate" trust with the user.
 */
export async function proposeAutonomyUpdate(args: {
  agentId: string;
  targetMode: 'AUTO' | 'HITL';
  reason: string;
  trustScore?: number;
}): Promise<string> {
  const { agentId, targetMode, reason, trustScore } = args;

  logger.info(
    `[GOVERNANCE] Agent ${agentId} is proposing a mode shift to ${targetMode}. Reason: ${reason}`
  );

  // 1. Record the proposal in governance_state
  const currentState =
    ((await ConfigManager.getRawConfig(DYNAMO_KEYS.GOVERNANCE_STATE)) as GovernanceState) || {};
  const proposalId = `prop_${Date.now()}`;

  const updatedState: GovernanceState = {
    ...currentState,
    activeProposals: {
      ...(currentState.activeProposals || {}),
      [proposalId]: {
        agentId,
        targetMode,
        reason,
        trustScore,
        createdAt: Date.now(),
        status: 'pending',
      },
    },
  };

  await ConfigManager.saveRawConfig(DYNAMO_KEYS.GOVERNANCE_STATE, updatedState, {
    author: agentId,
    description: `Autonomy proposal: ${targetMode} for ${agentId}`,
  });

  // 2. Emit an event to notify the Dashboard/Planner
  await emitTypedEvent('governance.propose', EventType.STRATEGIC_TIE_BREAK, {
    userId: 'SYSTEM',
    agentId: 'superclaw',
    task: `Governance Proposal: ${agentId} requests transition to ${targetMode}`,
    metadata: {
      proposalId,
      agentId,
      targetMode,
      reason,
      trustScore,
    },
  });

  return `SUCCESS: Proposal ${proposalId} submitted for ${targetMode} mode. Status: PENDING_USER_REVIEW.`;
}

/**
 * Retrieves workspace aggregated token, cost, latency, and tool telemetry logs.
 */
export async function getSwarmTelemetry(args: {
  workspaceId: string;
  timeRangeDays?: number;
  agentId?: string;
  toolName?: string;
}): Promise<unknown> {
  const days = args.timeRangeDays ?? 7;
  const scope = { workspaceId: args.workspaceId };

  if (args.toolName) {
    const rollups = await TokenTracker.getToolRollupRange(args.toolName, days, scope);
    return {
      type: 'tool_telemetry',
      toolName: args.toolName,
      days,
      metrics: rollups,
    };
  }

  const targetAgent = args.agentId ?? 'global';
  const rollups = await TokenTracker.getRollupRange(targetAgent, days, scope);
  const invocations = await TokenTracker.getInvocationHistory(targetAgent, 10, scope);

  return {
    type: 'agent_telemetry',
    agentId: targetAgent,
    days,
    rollups,
    recentInvocations: invocations,
  };
}

/**
 * Proposes a dynamic swarm collaboration topology DAG adjustment.
 */
export async function proposeTopologyChange(args: {
  workspaceId: string;
  proposalId: string;
  topologyName: string;
  proposedNodes: Record<string, AgentNode>;
  entryNode: string;
  proposedBy: string;
  justification: string;
}): Promise<string> {
  const proposal: SwarmProposal = {
    workspaceId: args.workspaceId,
    proposalId: args.proposalId,
    proposalType: ProposalType.TOPOLOGY,
    status: ProposalStatus.PENDING_HUMAN_APPROVAL,
    proposedBy: args.proposedBy,
    justification: args.justification,
    topologyProposal: {
      topologyName: args.topologyName,
      nodes: args.proposedNodes,
      entryNode: args.entryNode,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await CoManagementManager.saveProposal(proposal);

  await emitTypedEvent('governance.proposal.submit', EventType.STRATEGIC_TIE_BREAK, {
    userId: 'SYSTEM',
    agentId: args.proposedBy,
    task: `Governance: Topology Proposal ${args.proposalId} submitted for review`,
    metadata: {
      proposalId: args.proposalId,
      workspaceId: args.workspaceId,
      proposalType: ProposalType.TOPOLOGY,
      justification: args.justification,
    },
  });

  return `SUCCESS: Swarm Topology proposal ${args.proposalId} submitted to Workspace ${args.workspaceId}.`;
}

/**
 * Proposes a dynamic system prompt fragment optimization.
 */
export async function proposePromptOptimization(args: {
  workspaceId: string;
  proposalId: string;
  fragmentKey: string;
  proposedContent: string;
  proposedBy: string;
  justification: string;
}): Promise<string> {
  const proposal: SwarmProposal = {
    workspaceId: args.workspaceId,
    proposalId: args.proposalId,
    proposalType: ProposalType.PROMPT,
    status: ProposalStatus.PENDING_HUMAN_APPROVAL,
    proposedBy: args.proposedBy,
    justification: args.justification,
    promptProposal: {
      fragmentKey: args.fragmentKey,
      content: args.proposedContent,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await CoManagementManager.saveProposal(proposal);

  await emitTypedEvent('governance.proposal.submit', EventType.STRATEGIC_TIE_BREAK, {
    userId: 'SYSTEM',
    agentId: args.proposedBy,
    task: `Governance: Prompt Fragment Proposal ${args.proposalId} submitted for review`,
    metadata: {
      proposalId: args.proposalId,
      workspaceId: args.workspaceId,
      proposalType: ProposalType.PROMPT,
      justification: args.justification,
    },
  });

  return `SUCCESS: Prompt Fragment proposal ${args.proposalId} submitted to Workspace ${args.workspaceId}.`;
}

/**
 * Proposes a dynamic reputation scale, cost cap, or failure threshold adjustment.
 */
export async function suggestTrustScaleShift(args: {
  workspaceId: string;
  proposalId: string;
  proposedBy: string;
  justification: string;
  anomalyTolerance?: 'STRICT' | 'BALANCED' | 'PERMISSIVE';
  costCapPerRunUSD?: number;
  consecutiveFailureThreshold?: number;
  agentReputationalScores?: Record<string, number>;
}): Promise<string> {
  const proposal: SwarmProposal = {
    workspaceId: args.workspaceId,
    proposalId: args.proposalId,
    proposalType: ProposalType.TRUST,
    status: ProposalStatus.PENDING_HUMAN_APPROVAL,
    proposedBy: args.proposedBy,
    justification: args.justification,
    trustProposal: {
      anomalyTolerance: args.anomalyTolerance,
      costCapPerRunUSD: args.costCapPerRunUSD,
      consecutiveFailureThreshold: args.consecutiveFailureThreshold,
      agentReputationalScores: args.agentReputationalScores,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await CoManagementManager.saveProposal(proposal);

  await emitTypedEvent('governance.proposal.submit', EventType.STRATEGIC_TIE_BREAK, {
    userId: 'SYSTEM',
    agentId: args.proposedBy,
    task: `Governance: Trust Config Proposal ${args.proposalId} submitted for review`,
    metadata: {
      proposalId: args.proposalId,
      workspaceId: args.workspaceId,
      proposalType: ProposalType.TRUST,
      justification: args.justification,
    },
  });

  return `SUCCESS: Trust Config proposal ${args.proposalId} submitted to Workspace ${args.workspaceId}.`;
}
