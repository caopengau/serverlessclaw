import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../logger';
import type { BaseMemoryProvider } from '../base';
import { RetentionManager } from '../tiering';
import {
  Collaboration,
  CollaborationParticipant,
  CreateCollaborationInput,
  CollaborationRole,
  ParticipantType,
  getSyntheticUserId,
} from '../../types/collaboration';
import { MessageRole } from '../../types/llm';
import { ContextualScope } from '../../types/memory';
import { COLLAB_PREFIX, COLLAB_INDEX_PREFIX } from './constants';
import { getCollaboration } from './management';

/**
 * Creates a new collaboration with a shared session
 */
export async function createCollaboration(
  base: BaseMemoryProvider,
  ownerId: string,
  ownerType: ParticipantType,
  input: CreateCollaborationInput,
  scope?: string | ContextualScope
): Promise<Collaboration> {
  const collaborationId = uuidv4();
  const sessionId = input.sessionId ?? uuidv4();
  const now = Date.now();
  const workspaceId = (typeof scope === 'string' ? scope : scope?.workspaceId) ?? input.workspaceId;

  const participants: CollaborationParticipant[] = [
    { type: ownerType, id: ownerId, role: 'owner', joinedAt: now },
  ];

  if (input.initialParticipants) {
    const { AgentRegistry } = await import('../../registry');
    let pIdx = 1;
    for (const participant of input.initialParticipants) {
      if (participant.id !== ownerId) {
        if (participant.type === 'agent') {
          const agentConfig = await AgentRegistry.getAgentConfig(participant.id, { workspaceId });
          if (!agentConfig || agentConfig.enabled !== true) {
            throw new Error(
              `Agent ${participant.id} is disabled and cannot be invited to collaboration.`
            );
          }
        }

        participants.push({
          type: participant.type,
          id: participant.id,
          role: participant.role,
          joinedAt: now + pIdx++,
        });
      }
    }
  }

  const syntheticUserId = getSyntheticUserId(collaborationId);
  const { expiresAt: ttlExpiresAt } = await RetentionManager.getExpiresAt(
    'SESSIONS',
    collaborationId
  );
  const finalExpiresAt = input.ttlDays
    ? Math.floor((now + input.ttlDays * 24 * 60 * 60 * 1000) / 1000)
    : ttlExpiresAt;

  const collaboration: Collaboration = {
    collaborationId,
    name: input.name,
    description: input.description,
    sessionId,
    syntheticUserId,
    owner: { type: ownerType, id: ownerId },
    participants,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    expiresAt: finalExpiresAt,
    timeoutMs: input.timeoutMs,
    status: 'active',
    tags: input.tags,
    workspaceId,
  };

  const pk = base.getScopedUserId(`${COLLAB_PREFIX}${collaborationId}`, scope || workspaceId);
  await base.putItem(
    {
      userId: pk,
      timestamp: 0,
      type: 'COLLABORATION',
      ...collaboration,
    },
    {
      ConditionExpression: 'attribute_not_exists(userId)',
    }
  );

  let syncRequired = false;
  for (const participant of participants) {
    const indexPk = base.getScopedUserId(
      `${COLLAB_INDEX_PREFIX}${participant.type}#${participant.id}`,
      scope || workspaceId
    );

    let attempt = 0;
    let success = false;
    while (attempt < 5 && !success) {
      try {
        await base.putItem(
          {
            userId: indexPk,
            timestamp: participant.joinedAt + attempt,
            type: 'COLLABORATION_INDEX',
            collaborationId,
            role: participant.role,
            collaborationName: input.name,
            status: 'active',
            workspaceId,
          },
          {
            ConditionExpression: 'attribute_not_exists(userId)',
          }
        );
        if (attempt > 0) {
          participant.joinedAt += attempt;
          syncRequired = true;
        }
        success = true;
      } catch (e) {
        if ((e as Error).name === 'ConditionalCheckFailedException') {
          attempt++;
        } else {
          throw e;
        }
      }
    }
  }

  if (syncRequired) {
    await base.updateItem({
      TableName: base['tableName'] || 'MemoryTable',
      Key: { userId: pk, timestamp: 0 },
      UpdateExpression: 'SET participants = :p',
      ExpressionAttributeValues: { ':p': participants },
    });
  }

  logger.info(
    `Collaboration created: ${collaborationId} by ${ownerType}:${ownerId} in workspace: ${workspaceId}`
  );
  return collaboration;
}

/**
 * Closes a collaboration
 */
export async function closeCollaboration(
  base: BaseMemoryProvider,
  collaborationId: string,
  actorId: string,
  actorType: ParticipantType,
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
    throw new Error('Only owners can close collaborations');
  }

  const now = Date.now();
  const pk = base.getScopedUserId(`${COLLAB_PREFIX}${collaborationId}`, scope || workspaceId);

  await base.updateItem({
    Key: {
      userId: pk,
      timestamp: 0,
    },
    UpdateExpression: 'SET #status = :closed, updatedAt = :now, lastActivityAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':closed': 'closed',
      ':now': now,
    },
  });

  for (const participant of collaboration.participants) {
    try {
      const indexPk = base.getScopedUserId(
        `${COLLAB_INDEX_PREFIX}${participant.type}#${participant.id}`,
        scope
      );
      await base.deleteItem({
        userId: indexPk,
        timestamp: participant.joinedAt,
      });
    } catch (error) {
      logger.warn(`Failed to delete index entry for ${participant.type}:${participant.id}:`, error);
    }
  }

  logger.info(
    `Collaboration ${collaborationId} closed by ${actorType}:${actorId} in workspace ${workspaceId}`
  );
}

/**
 * Transits a 1:1 session into a collaboration session
 */
export async function transitToCollaboration(
  base: BaseMemoryProvider,
  userId: string,
  scope: string | ContextualScope,
  sourceSessionId: string,
  invitedAgentIds: string[],
  name?: string
): Promise<Collaboration> {
  const workspaceId = typeof scope === 'string' ? scope : scope?.workspaceId;
  const collaboration = await createCollaboration(
    base,
    userId,
    'human',
    {
      name: name || `Collaboration: ${sourceSessionId.substring(0, 8)}`,
      description: `Transited from session ${sourceSessionId}`,
      workspaceId,
      initialParticipants: [
        ...invitedAgentIds.map((id) => ({
          id,
          type: 'agent' as ParticipantType,
          role: 'editor' as CollaborationRole,
        })),
        {
          id: 'facilitator',
          type: 'agent' as ParticipantType,
          role: 'editor' as CollaborationRole,
        },
      ],
      tags: [`source_session:${sourceSessionId}`],
    },
    scope
  );

  try {
    const history = await base.getHistory(
      base.getScopedUserId(`CONV#${userId}#${sourceSessionId}`, scope)
    );
    if (history && history.length > 0) {
      const recent = history.slice(-5);
      const summary = recent.map((m) => `${m.role}: ${m.content}`).join('\n\n');
      const syntheticId = getSyntheticUserId(collaboration.collaborationId);

      await base.putItem({
        userId: base.getScopedUserId(syntheticId, scope),
        timestamp: Date.now(),
        type: 'MESSAGE',
        role: MessageRole.SYSTEM,
        content: `### Context Transition ###\n\nThis collaboration has been transited from a 1:1 session. Brief history summary:\n\n${summary}`,
        metadata: { type: 'context_transition' },
        traceId: `transit-${collaboration.collaborationId}`,
      });
    }
  } catch (e) {
    logger.warn(`Failed to seed history for collab ${collaboration.collaborationId}:`, e);
  }

  return collaboration;
}
