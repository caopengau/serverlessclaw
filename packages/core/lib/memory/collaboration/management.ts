import { logger } from '../../logger';
import type { BaseMemoryProvider } from '../base';
import {
  Collaboration,
  CollaborationParticipant,
  CollaborationRole,
  ParticipantType,
} from '../../types/collaboration';
import { ContextualScope } from '../../types/memory';
import { resolveScopeId } from '../utils';
import { COLLAB_PREFIX, COLLAB_INDEX_PREFIX } from './constants';

/**
 * Adds a participant to a collaboration
 */
export async function addCollaborationParticipant(
  base: BaseMemoryProvider,
  collaborationId: string,
  actorId: string,
  actorType: ParticipantType,
  newParticipant: { type: ParticipantType; id: string; role: CollaborationRole },
  scope?: string | ContextualScope
): Promise<void> {
  const collaboration = await getCollaboration(base, collaborationId, scope);
  if (!collaboration) {
    throw new Error(`Collaboration ${collaborationId} not found`);
  }

  const workspaceId =
    (typeof scope === 'string' ? scope : scope?.workspaceId) ?? collaboration.workspaceId;

  const actor = collaboration.participants.find((p) => p.id === actorId && p.type === actorType);
  if (!actor || actor.role !== 'owner') {
    throw new Error('Only owners can add participants');
  }

  const now = Date.now();
  const participant: CollaborationParticipant = {
    type: newParticipant.type,
    id: newParticipant.id,
    role: newParticipant.role,
    joinedAt: now,
  };

  if (newParticipant.type === 'agent') {
    const { AgentRegistry } = await import('../../registry');
    const agentConfig = await AgentRegistry.getAgentConfig(newParticipant.id, {
      workspaceId,
    });
    if (!agentConfig || agentConfig.enabled !== true) {
      throw new Error(`Agent ${newParticipant.id} is disabled and cannot be invited.`);
    }
  }

  let attempt = 0;
  let success = false;
  const indexPk = base.getScopedUserId(
    `${COLLAB_INDEX_PREFIX}${newParticipant.type}#${newParticipant.id}`,
    scope
  );

  while (attempt < 5 && !success) {
    try {
      await base.putItem(
        {
          userId: indexPk,
          timestamp: participant.joinedAt + attempt,
          type: 'COLLABORATION_INDEX',
          collaborationId,
          role: newParticipant.role,
          collaborationName: collaboration.name,
          status: 'active',
          workspaceId,
        },
        {
          ConditionExpression: 'attribute_not_exists(userId)',
        }
      );
      participant.joinedAt += attempt;
      success = true;
    } catch (e) {
      if ((e as Error).name === 'ConditionalCheckFailedException') {
        attempt++;
      } else {
        throw e;
      }
    }
  }

  const pk = base.getScopedUserId(`${COLLAB_PREFIX}${collaborationId}`, scope || workspaceId);
  await base.updateItem({
    Key: {
      userId: pk,
      timestamp: 0,
    },
    UpdateExpression:
      'SET participants = list_append(participants, :newParticipant), updatedAt = :now, lastActivityAt = :now',
    ConditionExpression: 'attribute_exists(userId)',
    ExpressionAttributeValues: {
      ':newParticipant': [participant],
      ':now': now,
    },
  });

  logger.info(
    `Participant ${newParticipant.type}:${newParticipant.id} added to collaboration ${collaborationId} in workspace ${workspaceId}`
  );
}

/**
 * Gets a collaboration by ID
 */
export async function getCollaboration(
  base: BaseMemoryProvider,
  collaborationId: string,
  scope?: string | ContextualScope
): Promise<Collaboration | null> {
  const workspaceId = resolveScopeId(scope);
  const pk = base.getScopedUserId(`${COLLAB_PREFIX}${collaborationId}`, scope || workspaceId);
  const result = await base.queryItems({
    KeyConditionExpression: 'userId = :userId AND #timestamp = :zero',
    ExpressionAttributeNames: { '#timestamp': 'timestamp' },
    ExpressionAttributeValues: {
      ':userId': pk,
      ':zero': 0,
    },
  });

  if (result.length === 0) return null;
  return result[0] as unknown as Collaboration;
}

/**
 * Lists collaborations for a participant
 */
export async function listCollaborationsForParticipant(
  base: BaseMemoryProvider,
  participantId: string,
  participantType: ParticipantType,
  scope?: string | ContextualScope
): Promise<Array<{ collaborationId: string; role: CollaborationRole; collaborationName: string }>> {
  const pk = base.getScopedUserId(
    `${COLLAB_INDEX_PREFIX}${participantType}#${participantId}`,
    scope
  );
  const result = await base.queryItems({
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': pk,
    },
  });

  return result.map((item) => ({
    collaborationId: item.collaborationId as string,
    role: item.role as CollaborationRole,
    collaborationName: item.collaborationName as string,
  }));
}

/**
 * Checks if a participant has access to a collaboration
 */
export async function checkCollaborationAccess(
  base: BaseMemoryProvider,
  collaborationId: string,
  participantId: string,
  participantType: ParticipantType,
  requiredRole?: CollaborationRole,
  scope?: string | ContextualScope
): Promise<boolean> {
  const collaboration = await getCollaboration(base, collaborationId, scope);
  if (!collaboration) return false;

  const participant = collaboration.participants.find(
    (p) => p.id === participantId && p.type === participantType
  );

  if (!participant) return false;
  if (collaboration.status !== 'active') return false;

  if (requiredRole) {
    if (requiredRole === 'owner' && participant.role !== 'owner') return false;
    if (requiredRole === 'editor' && participant.role === 'viewer') return false;
  }

  return true;
}

/**
 * Updates the last activity timestamp for a collaboration atomically
 */
export async function updateCollaborationActivity(
  base: BaseMemoryProvider,
  collaborationId: string,
  scope?: string | ContextualScope
): Promise<void> {
  const workspaceId = resolveScopeId(scope);
  const pk = base.getScopedUserId(`${COLLAB_PREFIX}${collaborationId}`, scope || workspaceId);
  const now = Date.now();

  try {
    await base.updateItem({
      Key: {
        userId: pk,
        timestamp: 0,
      },
      UpdateExpression: 'SET lastActivityAt = :now, updatedAt = :now',
      ConditionExpression: 'attribute_exists(userId)',
      ExpressionAttributeValues: {
        ':now': now,
      },
    });
  } catch (e) {
    if ((e as Error).name !== 'ConditionalCheckFailedException') {
      logger.warn(`Failed to update collaboration activity for ${collaborationId}:`, e);
    }
  }
}

/**
 * Finds collaborations that have timed out based on their custom timeoutMs.
 */
export async function findStaleCollaborations(
  base: BaseMemoryProvider,
  defaultTimeoutMs: number,
  scope?: string | ContextualScope
): Promise<Collaboration[]> {
  const workspaceId = typeof scope === 'string' ? scope : scope?.workspaceId;
  const now = Date.now();

  const params: Record<string, unknown> = {
    IndexName: 'TypeTimestampIndex',
    KeyConditionExpression: '#type = :type',
    FilterExpression: workspaceId
      ? '#status = :active AND workspaceId = :workspaceId'
      : '#status = :active',
    ExpressionAttributeNames: { '#status': 'status', '#type': 'type' },
    ExpressionAttributeValues: {
      ':active': 'active',
      ':type': 'COLLABORATION',
      ...(workspaceId ? { ':workspaceId': workspaceId } : {}),
    },
  };

  const allActive = await base.queryItems(params);

  return (allActive as unknown as Collaboration[]).filter((c) => {
    const timeout = c.timeoutMs || defaultTimeoutMs;
    return now - c.lastActivityAt > timeout;
  });
}
