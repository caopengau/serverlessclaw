/**
 * Collaboration Tools for Agent Multi-Party Collaboration
 * Enables agents to create and participate in shared sessions
 */

import { collaborationTools as definitions } from './definitions/collaboration';
import { ParticipantType, CollaborationRole } from '../lib/types/collaboration';
import { getAgentContext } from '../lib/utils/agent-helpers';
import { ITool } from '../lib/types/tool';

/**
 * Creates a new collaboration session.
 */
export const CREATE_COLLABORATION: ITool = {
  ...definitions.createCollaboration,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { agentId, memory } = await getAgentContext();

    const collaboration = await memory.createCollaboration(agentId, 'agent', {
      name: args.name as string,
      description: args.description as string | undefined,
      sessionId: undefined, // Auto-generated
      ttlDays: args.ttlDays as number | undefined,
      tags: args.tags as string[] | undefined,
      initialParticipants: args.participants as
        | Array<{
            type: ParticipantType;
            id: string;
            role: CollaborationRole;
          }>
        | undefined,
    });

    return JSON.stringify({
      success: true,
      collaborationId: collaboration.collaborationId,
      sessionId: collaboration.sessionId,
      syntheticUserId: collaboration.syntheticUserId,
      participants: collaboration.participants,
      message: `Collaboration "${collaboration.name}" created. Use collaborationId for shared context.`,
    });
  },
};

/**
 * Joins an existing collaboration.
 */
export const JOIN_COLLABORATION: ITool = {
  ...definitions.joinCollaboration,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { agentId, memory } = await getAgentContext();
    const collaborationId = args.collaborationId as string;
    const collaboration = await memory.getCollaboration(collaborationId);

    if (!collaboration) {
      return JSON.stringify({ success: false, error: 'Collaboration not found' });
    }

    const isParticipant = collaboration.participants.some(
      (p) => p.id === agentId && p.type === 'agent'
    );

    if (!isParticipant) {
      return JSON.stringify({ success: false, error: 'Not a participant in this collaboration' });
    }

    return JSON.stringify({
      success: true,
      collaborationId: collaboration.collaborationId,
      sessionId: collaboration.sessionId,
      syntheticUserId: collaboration.syntheticUserId,
      name: collaboration.name,
      participants: collaboration.participants,
    });
  },
};

/**
 * Gets the shared session context for a collaboration.
 */
export const GET_COLLABORATION_CONTEXT: ITool = {
  ...definitions.getCollaborationContext,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { agentId, memory } = await getAgentContext();
    const collaborationId = args.collaborationId as string;
    const limit = (args.limit as number) ?? 50;

    const collaboration = await memory.getCollaboration(collaborationId);
    if (!collaboration) {
      return JSON.stringify({ success: false, error: 'Collaboration not found' });
    }

    const hasAccess = await memory.checkCollaborationAccess(collaborationId, agentId, 'agent');

    if (!hasAccess) {
      return JSON.stringify({ success: false, error: 'Access denied' });
    }

    const history = await memory.getHistory(collaboration.syntheticUserId);
    const limitedHistory = history.slice(-limit);

    return JSON.stringify({
      success: true,
      collaborationId,
      sessionId: collaboration.sessionId,
      messageCount: limitedHistory.length,
      messages: limitedHistory.map((m) => ({
        role: m.role,
        content: m.content,
        agentName: m.agentName,
        timestamp: m.timestamp,
      })),
    });
  },
};

/**
 * Writes a message to the shared collaboration session.
 */
export const WRITE_TO_COLLABORATION: ITool = {
  ...definitions.writeToCollaboration,
  execute: async (args: Record<string, unknown>): Promise<string> => {
    const { agentId, memory } = await getAgentContext();
    const collaborationId = args.collaborationId as string;
    const content = args.content as string;
    const role = (args.role as string) ?? 'assistant';

    const collaboration = await memory.getCollaboration(collaborationId);
    if (!collaboration) {
      return JSON.stringify({ success: false, error: 'Collaboration not found' });
    }

    const hasAccess = await memory.checkCollaborationAccess(
      collaborationId,
      agentId,
      'agent',
      'editor'
    );

    if (!hasAccess) {
      return JSON.stringify({ success: false, error: 'Access denied or insufficient permissions' });
    }

    await memory.addMessage(collaboration.syntheticUserId, {
      role: role as 'user' | 'assistant',
      content,
      agentName: agentId,
    });

    return JSON.stringify({
      success: true,
      message: 'Message written to collaboration session',
    });
  },
};

/**
 * Lists collaborations for the current agent.
 */
export const LIST_MY_COLLABORATIONS: ITool = {
  ...definitions.listMyCollaborations,
  execute: async (): Promise<string> => {
    const { agentId, memory } = await getAgentContext();
    const collaborations = await memory.listCollaborationsForParticipant(agentId, 'agent');

    return JSON.stringify({
      success: true,
      count: collaborations.length,
      collaborations,
    });
  },
};
