import { toolDefinitions } from './definitions/index';
import { emitEvent } from '../lib/utils/bus';
import { EventType } from '../lib/types/agent';
import { formatErrorMessage } from '../lib/utils/error';
import { v4 as uuidv4 } from 'uuid';

/**
 * Initiates a consensus request to the swarm.
 */
export const REQUEST_CONSENSUS = {
  ...toolDefinitions.requestConsensus,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const {
      proposal,
      participants,
      mode = 'majority',
      initiatorId = 'superclaw',
    } = args as {
      proposal: string;
      participants: string[];
      mode?: string;
      initiatorId?: string;
    };

    const requestId = uuidv4();

    try {
      await emitEvent(initiatorId, EventType.CONSENSUS_REQUEST, {
        requestId,
        proposal,
        initiatorId,
        participants,
        mode,
        timestamp: Date.now(),
      });
      return `CONSENSUS_PENDING: Request ${requestId} initiated. Waiting for ${participants.length} peers to vote.`;
    } catch (error) {
      return `Failed to initiate consensus: ${formatErrorMessage(error)}`;
    }
  },
};

/**
 * Submits a vote for an active consensus request.
 */
export const SUBMIT_VOTE = {
  ...toolDefinitions.submitVote,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { requestId, vote, reasoning, voterId } = args as {
      requestId: string;
      vote: boolean;
      reasoning: string;
      voterId: string;
    };

    try {
      await emitEvent(voterId, EventType.CONSENSUS_VOTE, {
        requestId,
        voterId,
        vote,
        reasoning,
        timestamp: Date.now(),
      });
      return `VOTE_SUBMITTED: Your ${vote ? 'YES' : 'NO'} vote for request ${requestId} has been recorded.`;
    } catch (error) {
      return `Failed to submit vote: ${formatErrorMessage(error)}`;
    }
  },
};
