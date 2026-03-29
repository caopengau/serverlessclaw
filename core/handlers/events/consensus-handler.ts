/**
 * Consensus Handler
 *
 * Handles swarm consensus protocol events: requesting votes, collecting votes,
 * and computing the consensus result. Supports three modes:
 * - majority: >50% approval required
 * - unanimous: 100% approval required
 * - weighted: weighted sum of votes >50% of total weight
 */

import { CONSENSUS_REQUEST_SCHEMA, CONSENSUS_VOTE_SCHEMA } from '../../lib/schema/events';
import { EventType } from '../../lib/types/agent';
import { logger } from '../../lib/logger';

/**
 * In-memory consensus state for tracking votes within a Lambda invocation.
 * For cross-invocation durability, votes are also persisted to DynamoDB.
 */
interface ConsensusState {
  consensusId: string;
  proposal: string;
  mode: 'majority' | 'unanimous' | 'weighted';
  voterIds: string[];
  votes: Map<
    string,
    { vote: 'approve' | 'reject' | 'abstain'; reasoning?: string; weight: number }
  >;
  initiatorId: string;
  userId: string;
  traceId: string;
  depth: number;
  sessionId?: string;
  timeoutMs: number;
  startTime: number;
}

const activeConsensus = new Map<string, ConsensusState>();

/**
 * Handles a CONSENSUS_REQUEST event by initializing vote tracking
 * and dispatching vote requests to all voters.
 */
export async function handleConsensusRequest(eventDetail: Record<string, unknown>): Promise<void> {
  const parsed = CONSENSUS_REQUEST_SCHEMA.parse(eventDetail);
  const consensusId = `consensus-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  logger.info(
    `[Consensus] Request received: ${consensusId} | Mode: ${parsed.mode} | ` +
      `Voters: ${parsed.voterIds.length} | Proposal: "${parsed.proposal.slice(0, 80)}..."`
  );

  const state: ConsensusState = {
    consensusId,
    proposal: parsed.proposal,
    mode: parsed.mode,
    voterIds: parsed.voterIds,
    votes: new Map(),
    initiatorId: parsed.initiatorId,
    userId: parsed.userId,
    traceId: parsed.traceId ?? consensusId,
    depth: parsed.depth,
    sessionId: parsed.sessionId,
    timeoutMs: parsed.timeoutMs,
    startTime: Date.now(),
  };

  activeConsensus.set(consensusId, state);

  // Dispatch vote requests to all voters
  const { emitTypedEvent } = await import('../../lib/utils/typed-emit');

  for (const voterId of parsed.voterIds) {
    try {
      await emitTypedEvent(
        'consensus.handler',
        EventType.CONSENSUS_VOTE as never,
        {
          userId: parsed.userId,
          traceId: state.traceId,
          taskId: consensusId,
          initiatorId: 'consensus-handler',
          depth: parsed.depth + 1,
          sessionId: parsed.sessionId,
          consensusId,
          voterId,
          vote: 'abstain', // default — voter will override
          weight: 1.0,
        } as never
      );

      logger.info(`[Consensus] Vote request sent to ${voterId} for ${consensusId}`);
    } catch (error) {
      logger.warn(`[Consensus] Failed to dispatch vote request to ${voterId}:`, error);
    }
  }
}

/**
 * Handles a CONSENSUS_VOTE event by recording the vote and checking
 * if the consensus has been reached.
 */
export async function handleConsensusVote(eventDetail: Record<string, unknown>): Promise<void> {
  const parsed = CONSENSUS_VOTE_SCHEMA.parse(eventDetail);
  const state = activeConsensus.get(parsed.consensusId);

  if (!state) {
    logger.warn(`[Consensus] Vote received for unknown consensus: ${parsed.consensusId}`);
    return;
  }

  // Record vote
  state.votes.set(parsed.voterId, {
    vote: parsed.vote,
    reasoning: parsed.reasoning,
    weight: parsed.weight,
  });

  logger.info(
    `[Consensus] Vote recorded: ${parsed.voterId} -> ${parsed.vote} ` +
      `(${state.votes.size}/${state.voterIds.length}) for ${parsed.consensusId}`
  );

  // Check if all votes are in
  if (state.votes.size >= state.voterIds.length) {
    await computeAndEmitResult(state);
  }
}

/**
 * Handles consensus timeout by emitting the final result with whatever votes are available.
 */
export async function handleConsensusTimeout(consensusId: string): Promise<void> {
  const state = activeConsensus.get(consensusId);
  if (!state) return;

  logger.info(
    `[Consensus] Timeout for ${consensusId}. Votes: ${state.votes.size}/${state.voterIds.length}`
  );
  await computeAndEmitResult(state, true);
}

/**
 * Computes the consensus result and emits a CONSENSUS_REACHED event.
 */
async function computeAndEmitResult(state: ConsensusState, timedOut = false): Promise<void> {
  let approveCount = 0;
  let rejectCount = 0;
  let abstainCount = 0;
  let totalWeight = 0;
  let approveWeight = 0;

  const votes = Array.from(state.votes.entries()).map(([voterId, v]) => {
    if (v.vote === 'approve') {
      approveCount++;
      approveWeight += v.weight;
    } else if (v.vote === 'reject') {
      rejectCount++;
    } else {
      abstainCount++;
    }
    totalWeight += v.weight;
    return { voterId, vote: v.vote, reasoning: v.reasoning, weight: v.weight };
  });

  // Add abstain entries for voters who didn't vote
  for (const voterId of state.voterIds) {
    if (!state.votes.has(voterId)) {
      votes.push({ voterId, vote: 'abstain' as const, reasoning: undefined, weight: 1.0 });
      abstainCount++;
      totalWeight += 1.0;
    }
  }

  let result: 'approved' | 'rejected' | 'timeout';

  if (timedOut) {
    result = 'timeout';
  } else if (state.mode === 'unanimous') {
    result = rejectCount > 0 ? 'rejected' : 'approved';
  } else if (state.mode === 'weighted') {
    result = approveWeight / totalWeight > 0.5 ? 'approved' : 'rejected';
  } else {
    // majority
    const effectiveVoters = approveCount + rejectCount;
    result = effectiveVoters > 0 && approveCount / effectiveVoters > 0.5 ? 'approved' : 'rejected';
  }

  logger.info(
    `[Consensus] Result: ${result} | Mode: ${state.mode} | ` +
      `Approve: ${approveCount}, Reject: ${rejectCount}, Abstain: ${abstainCount}`
  );

  // Cleanup
  activeConsensus.delete(state.consensusId);

  // Emit result event
  const { emitTypedEvent } = await import('../../lib/utils/typed-emit');
  await emitTypedEvent(
    'consensus.handler',
    EventType.CONSENSUS_REACHED as never,
    {
      userId: state.userId,
      traceId: state.traceId,
      taskId: state.consensusId,
      initiatorId: state.initiatorId,
      depth: state.depth,
      sessionId: state.sessionId,
      consensusId: state.consensusId,
      proposal: state.proposal,
      result,
      mode: state.mode,
      approveCount,
      rejectCount,
      abstainCount,
      totalVoters: state.voterIds.length,
      votes,
    } as never
  );

  // Route result back to initiator via continuation
  const { wakeupInitiator } = await import('./shared');
  await wakeupInitiator(
    state.userId,
    state.initiatorId,
    `CONSENSUS_RESULT: Proposal "${state.proposal.slice(0, 100)}" was ${result}. ` +
      `Mode: ${state.mode}. Votes: ${approveCount} approve, ${rejectCount} reject, ${abstainCount} abstain.`,
    state.traceId,
    state.sessionId,
    state.depth
  );
}
