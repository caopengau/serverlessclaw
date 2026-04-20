import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { HTTP_STATUS } from '@claw/core/lib/constants';
import { AgentType, ParticipantType, MessageRole } from '@claw/core/lib/types/index';
import { DynamoMemory, CachedMemory } from '@claw/core/lib/memory';
import { AgentRegistry } from '@claw/core/lib/registry';
import { logger } from '@claw/core/lib/logger';
import { AUTH } from '@/lib/constants';

const memory = new CachedMemory(new DynamoMemory());

function getUserId(req: NextRequest): string {
  if (!req.cookies) return 'dashboard-user';
  const sessionCookie = req.cookies.get(AUTH.SESSION_USER_ID);
  return sessionCookie?.value || 'dashboard-user';
}

/**
 * POST /api/collaboration/transit
 * 
 * Transits a 1:1 trace session into a formal Multi-Agent Collaboration session.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { sessionId, invitedAgentIds, name } = await req.json();
    const userId = getUserId(req);

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    logger.info(`[Collab Transit] Initiating transit for session: ${sessionId}, inviting: ${invitedAgentIds}`);

    // Principle 14: Verify all invited agents are enabled
    const allInvited = [...(invitedAgentIds || []), AgentType.FACILITATOR];
    for (const agentId of allInvited) {
      const cfg = await AgentRegistry.getAgentConfig(agentId);
      if (!cfg || cfg.enabled !== true) {
        return NextResponse.json(
          { error: `Cannot invite agent ${agentId} - node is disabled or missing.` },
          { status: HTTP_STATUS.FORBIDDEN }
        );
      }
    }

    // 1. Create the collaboration
    // We use the human user as the owner
    const collaboration = await memory.createCollaboration(
      userId,
      'human',
      {
        name: name || `Collaboration: ${sessionId.substring(0, 8)}`,
        description: `Transited from trace session ${sessionId}`,
        initialParticipants: [
          // The owner (human) is added automatically by createCollaboration
          // Add the invited agents
          ...(invitedAgentIds || []).map((id: string) => ({
            id,
            type: 'agent' as ParticipantType,
            role: 'editor',
          })),
          // Auto-inject Facilitator
          {
            id: AgentType.FACILITATOR,
            type: 'agent' as ParticipantType,
            role: 'editor',
          }
        ],
        // Link to the existing trace session if possible (metadata only)
        tags: [`trace_session:${sessionId}`]
      }
    );

    // 2. Optional: Seed the collaboration with the last few messages from history
    // (This ensures context continuity in the new shared session)
    try {
      const history = await memory.getHistory(`CONV#${userId}#${sessionId}`);
      if (history && history.length > 0) {
        // We take the last 5 messages as context summary
        const recent = history.slice(-5);
        const summary = recent.map(m => `${m.role}: ${m.content}`).join('\n\n');
        
        await memory.addMessage(`shared#collab#${collaboration.collaborationId}`, {
          role: MessageRole.SYSTEM,
          content: `### Context Transition ###\n\nThis collaboration has been transited from a 1:1 session. Brief history summary:\n\n${summary}`,
          name: AgentType.FACILITATOR,
          traceId: `transit-${collaboration.collaborationId}`,
          messageId: `transit-${collaboration.collaborationId}-seed`,
        }, (userId as string | undefined));
      }
    } catch (e) {
      logger.warn('[Collab Transit] Failed to seed history:', e);
    }

    return NextResponse.json({ 
      success: true, 
      collaborationId: collaboration.collaborationId,
      name: collaboration.name
    });

  } catch (error) {
    logger.error('[Collab Transit] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
