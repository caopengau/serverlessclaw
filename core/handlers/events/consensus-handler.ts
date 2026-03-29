import { EventType } from '../../lib/types/agent';
import { logger } from '../../lib/logger';
import { emitEvent } from '../../lib/utils/bus';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getDocClient } from '../../lib/utils/ddb-client';
import { Resource } from 'sst';

/**
 * Handles consensus requests and votes from the swarm.
 * Manages the state of active consensus cycles in DynamoDB.
 */
export async function handleConsensus(event: { detail: any }, detailType: string): Promise<void> {
  const docClient = getDocClient();
  const resource = Resource as unknown as { MemoryTable: { name: string } };
  const tableName = resource.MemoryTable.name;

  if (detailType === EventType.CONSENSUS_REQUEST) {
    const { requestId, proposal, initiatorId, participants, mode = 'majority' } = event.detail;

    logger.info(`[Consensus] New request ${requestId} from ${initiatorId} (Mode: ${mode})`);

    // Initialize consensus state
    await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { userId: `CONSENSUS#${requestId}`, timestamp: 0 },
        UpdateExpression:
          'SET proposal = :prop, initiatorId = :init, participants = :parts, mode = :mode, votes = :empty_list, status = :status, createdAt = :now',
        ExpressionAttributeValues: {
          ':prop': proposal,
          ':init': initiatorId,
          ':parts': participants,
          ':mode': mode,
          ':empty_list': [],
          ':status': 'PENDING',
          ':now': Date.now(),
        },
      })
    );
  } else if (detailType === EventType.CONSENSUS_VOTE) {
    const { requestId, voterId, vote, reasoning } = event.detail;

    logger.info(`[Consensus] Vote from ${voterId} for ${requestId}: ${vote ? 'YES' : 'NO'}`);

    // Add vote atomically
    const response = await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { userId: `CONSENSUS#${requestId}`, timestamp: 0 },
        UpdateExpression: 'SET votes = list_append(if_not_exists(votes, :empty_list), :vote)',
        ExpressionAttributeValues: {
          ':vote': [{ voterId, vote, reasoning, timestamp: Date.now() }],
          ':empty_list': [],
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    const state = response.Attributes;
    if (!state) return;

    // Check if consensus is reached
    const totalVotes = state.votes.length;
    const requiredParticipants = state.participants.length;
    const yesVotes = state.votes.filter((v: { vote: boolean }) => v.vote).length;

    let isReached = false;
    let finalResult = false;

    if (state.mode === 'unanimous') {
      if (totalVotes === requiredParticipants) {
        isReached = true;
        finalResult = yesVotes === requiredParticipants;
      }
    } else {
      // default to majority
      if (
        totalVotes >= Math.ceil(requiredParticipants / 2) + 1 ||
        totalVotes === requiredParticipants
      ) {
        isReached = true;
        finalResult = yesVotes > totalVotes / 2;
      }
    }

    if (isReached && state.status === 'PENDING') {
      logger.info(
        `[Consensus] Request ${requestId} finalized: ${finalResult ? 'APPROVED' : 'REJECTED'}`
      );

      await docClient.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { userId: `CONSENSUS#${requestId}`, timestamp: 0 },
          UpdateExpression: 'SET status = :status, finalizedAt = :now, result = :result',
          ExpressionAttributeValues: {
            ':status': 'COMPLETED',
            ':now': Date.now(),
            ':result': finalResult,
          },
        })
      );

      await emitEvent('consensus-handler', EventType.CONSENSUS_REACHED, {
        requestId,
        result: finalResult,
        initiatorId: state.initiatorId,
        votes: state.votes,
      });
    }
  }
}
