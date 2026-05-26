import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';
import { UI_STRINGS } from '@/lib/constants';
import { HTTP_STATUS, CONFIG_KEYS } from '@claw/core/lib/constants';
import { revalidatePath } from 'next/cache';

// Re-usable instances for optimization
import { DynamoMemory, CachedMemory } from '@claw/core/lib/memory';
import { ProviderManager } from '@claw/core/lib/providers/index';
import { getAgentTools } from '@claw/core/tools/index';
import { Agent } from '@claw/core/lib/agent';
import { SUPERCLAW_SYSTEM_PROMPT } from '@claw/core/agents/superclaw/constants';
import { AGENT_TYPES, IAgentConfig, TraceSource } from '@claw/core/lib/types/index';
import { AgentRegistry } from '@claw/core/lib/registry';
import { logger } from '@claw/core/lib/logger';
import { SessionStateManager } from '@claw/core/lib/session/session-state';
import { ConfigManager } from '@claw/core/lib/registry/config';

let memoryInstance: CachedMemory | null = null;
let providerInstance: ProviderManager | null = null;

interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface StreamChunk {
  content?: string;
  thought?: string;
  tool_calls?: import('@claw/core/lib/types/index').ToolCall[];
  messageId?: string;
  usage?: Usage;
  modelName?: string;
  model?: string;
}

function getMemory() {
  if (!memoryInstance) memoryInstance = new CachedMemory(new DynamoMemory());
  return memoryInstance;
}

function getProvider() {
  if (!providerInstance) providerInstance = new ProviderManager();
  return providerInstance;
}

function normalizeLocale(input?: string): 'en' | 'cn' | undefined {
  if (!input) return undefined;
  const normalized = input.toLowerCase();
  if (normalized === 'cn' || normalized.startsWith('zh')) return 'cn';
  if (normalized === 'en' || normalized.startsWith('en')) return 'en';
  return undefined;
}

/**
 * Handles chat messages from the dashboard UI.
 * Simplification: Uses MQTT (SST Realtime) for token streaming.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const {
      text,
      sessionId,
      attachments,
      approvedToolCalls,
      traceId: clientTraceId,
      pageContext,
      profile,
      agentId = AGENT_TYPES.SUPERCLAW,
      agentIds,
      collaborationId,
      isIsolated = false,
      source: incomingSource,
      overrideConfig,
      promptOverrides,
      workspaceId: incomingWorkspaceId,
      teamId,
      staffId,
      force,
      locale,
    } = await req.json();

    const workspaceId = incomingWorkspaceId || 'default';
    const source = incomingSource || TraceSource.DASHBOARD;

    const userId = getUserId(req);
    const storageId = sessionId ? `CONV#${userId}#${sessionId}` : userId;

    // Phase 15: RBAC Role Fetching
    const { getIdentityManager, Permission } = await import('@claw/core/lib/session/identity');
    const identityManager = await getIdentityManager();

    // Verify workspace access and task creation permission
    const hasPermission = await identityManager.hasPermission(
      userId,
      Permission.TASK_CREATE,
      workspaceId
    );
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Unauthorized workspace access or missing TASK_CREATE permission' },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    const identity = await identityManager.getUser(userId);
    const userRole = identity?.role;

    if (!text && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { error: UI_STRINGS.MISSING_MESSAGE },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // In multi-agent mode, use the primary agentId (usually the first in the list)
    const primaryAgentId = agentIds && agentIds.length > 0 ? agentIds[0] : agentId;

    // Verify workspace access and agent invocation permission
    const hasAgentInvokePermission = await identityManager.hasPermission(
      userId,
      Permission.AGENT_INVOKE,
      workspaceId
    );
    if (!hasAgentInvokePermission) {
      return NextResponse.json(
        { error: 'Unauthorized workspace access or missing AGENT_INVOKE permission' },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    // Verify fine-grained agent resource access (e.g. customized ACLs)
    const hasAgentResourceAccess = await identityManager.hasResourceAccess(
      userId,
      'agent',
      primaryAgentId
    );
    if (!hasAgentResourceAccess) {
      return NextResponse.json(
        { error: `Unauthorized. You do not have access to trigger agent '${primaryAgentId}'` },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    logger.info(
      `[Chat API] POST - userId: ${userId}, sessionId: ${sessionId}, traceId: ${clientTraceId}, agentId: ${primaryAgentId}, workspaceId: ${workspaceId}`
    );

    // If we're in a collaboration session, we might need special logic in the future.
    // For now, we route to the specific agent requested.

    const config = await AgentRegistry.getAgentConfig(primaryAgentId, { workspaceId });
    const agentTools = await getAgentTools(primaryAgentId, { workspaceId });

    const configuredLocale = normalizeLocale(
      (await ConfigManager.getTypedConfig<string>(CONFIG_KEYS.ACTIVE_LOCALE, 'cn', {
        workspaceId,
      })) || 'cn'
    );
    const effectiveLocale = normalizeLocale(locale) ?? configuredLocale ?? 'cn';

    if (!config) {
      return NextResponse.json(
        { error: `Agent ${primaryAgentId} not found in registry.` },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    // Principle 14 Check
    if (config.enabled !== true) {
      return NextResponse.json(
        { error: `Agent ${primaryAgentId} is currently disabled and cannot process requests.` },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    // Determine communication mode based on collaboration participants
    let communicationMode: 'text' | 'json' = 'text';
    if (collaborationId) {
      const collab = collaborationId
        ? await getMemory().getCollaboration(collaborationId as string, { workspaceId })
        : null;
      if (collab) {
        const hasHuman =
          collab.owner.type === 'human' || collab.participants.some((p) => p.type === 'human');

        communicationMode = hasHuman ? 'text' : 'json';
        logger.info(
          `[Chat API] Collaboration detected. hasHuman: ${hasHuman} -> mode: ${communicationMode}`
        );
      }
    }

    const agent = new Agent(getMemory(), getProvider(), agentTools, {
      ...config,
      ...(overrideConfig || {}),
      workspaceId,
      teamId,
      staffId,
      locale: effectiveLocale,
      systemPrompt:
        promptOverrides?.[primaryAgentId] ??
        overrideConfig?.systemPrompt ??
        config?.systemPrompts?.[effectiveLocale] ??
        config?.systemPrompt ??
        SUPERCLAW_SYSTEM_PROMPT,
    } as IAgentConfig);

    // B3 Awareness: Acquire processing lock to prevent concurrent swarm collisions
    const sessionStateManager = new SessionStateManager();
    if (sessionId) {
      if (force) {
        logger.info(`[Chat API] Force unlock requested for session ${sessionId} by ${userId}`);
        await sessionStateManager.releaseProcessing(sessionId, `dashboard-${userId}`, {
          workspaceId,
          teamId,
          staffId,
        });
      }

      const canProcess = await sessionStateManager.acquireProcessing(
        sessionId,
        `dashboard-${userId}`,
        {
          workspaceId,
          teamId,
          staffId,
        }
      );

      if (!canProcess) {
        logger.warn(
          `[Chat API] Session ${sessionId} is busy. Rejecting concurrent request from ${userId}`
        );
        return NextResponse.json(
          {
            error: 'Session is currently busy with another request.',
            details:
              'This session is locked by another active process. You can try again in a few minutes or use "Force Unlock" if you believe the process is stuck.',
          },
          { status: HTTP_STATUS.TOO_MANY_REQUESTS }
        );
      }
    }

    try {
      // We use the streaming generator to trigger real-time MQTT emissions via AgentEmitter
      // while the request remains open. Chunks are automatically sent to the dashboard via IoT Core.
      const stream = agent.stream(storageId, text ?? '', {
        sessionId,
        source,
        isIsolated,
        attachments,
        approvedToolCalls,
        traceId: clientTraceId || undefined,
        pageContext,
        profile,
        communicationMode,
        agentIds, // Pass the swarm context to the agent
        workspaceId,
        teamId,
        staffId,
        userRole,
        activeUser: identity
          ? {
              id: identity.userId,
              displayName: identity.displayName,
              role: identity.role,
              workspaceIds: identity.workspaceIds,
            }
          : undefined,
      });

      let finalResponse = '';
      let finalThought = '';
      let finalToolCalls: import('@claw/core/lib/types/index').ToolCall[] = [];
      let finalMessageId = '';
      let finalUsage: Usage | null = null;
      let finalModelName = config.model || 'unknown';

      for await (const chunk of stream as AsyncIterable<StreamChunk>) {
        if (chunk.content) finalResponse += chunk.content;
        if (chunk.thought) finalThought += chunk.thought;
        if (chunk.tool_calls) finalToolCalls = chunk.tool_calls;
        if (chunk.messageId) finalMessageId = chunk.messageId;
        if (chunk.usage) finalUsage = chunk.usage;
        if (chunk.modelName || chunk.model) {
          finalModelName = chunk.modelName || chunk.model || finalModelName;
        }
      }

      logger.info(
        `[Chat API] Stream finished - sessionId: ${sessionId}, agent: ${primaryAgentId}, response length: ${finalResponse.length}`
      );

      // Update conversation metadata for the sidebar
      if (sessionId) {
        await getMemory().saveConversationMeta(
          userId,
          sessionId,
          {
            lastMessage:
              finalResponse.length > 60 ? finalResponse.substring(0, 60) + '...' : finalResponse,
            updatedAt: Date.now(),
            // Store the last agent used in this session if it's not superclaw
            metadata:
              primaryAgentId !== AGENT_TYPES.SUPERCLAW
                ? { lastAgentId: primaryAgentId }
                : undefined,
          },
          { workspaceId, teamId, staffId }
        );
      }

      // Filter out synthetic thought markers ('…') that were only used to trigger the thinking indicator
      const meaningfulThought = (finalThought || '').trim();
      const thoughtToReturn = meaningfulThought.length > 1 ? meaningfulThought : '';

      return NextResponse.json({
        reply: (finalResponse || '').trim(),
        thought: thoughtToReturn,
        agentName: config.name || primaryAgentId,
        messageId: finalMessageId,
        tool_calls: finalToolCalls,
        sessionId: sessionId || undefined,
        model: finalModelName,
        usage: finalUsage,
      });
    } finally {
      if (sessionId) {
        await sessionStateManager.releaseProcessing(sessionId, `dashboard-${userId}`, {
          workspaceId,
          teamId,
          staffId,
        });
      }
    }
  } catch (error) {
    logger.error(UI_STRINGS.API_CHAT_ERROR, error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}

/**
 * Updates conversation metadata (like title)
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const { sessionId, title, isPinned, mission, workspaceId = 'default' } = await req.json();
    const userId = getUserId(req);

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    await getMemory().saveConversationMeta(
      userId,
      sessionId,
      {
        title,
        isPinned,
        mission,
        updatedAt: Date.now(),
      },
      { workspaceId }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to update session:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

/**
 * Deletes one or all conversation sessions
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId');
    const workspaceId = req.nextUrl.searchParams.get('workspaceId') || 'default';
    const userId = getUserId(req);

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    if (sessionId === 'all') {
      const sessions = await getMemory().listConversations(userId, { workspaceId });
      await Promise.all(
        sessions.map((s) => getMemory().deleteConversation(userId, s.sessionId, { workspaceId }))
      );
      revalidatePath('/');
      return NextResponse.json({ success: true, count: sessions.length });
    }

    await getMemory().deleteConversation(userId, sessionId, { workspaceId });
    revalidatePath('/');

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete session:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}

/**
 * Retrieves chat sessions or history
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = getUserId(req);
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const workspaceId = req.nextUrl.searchParams.get('workspaceId') || 'default';
  try {
    if (sessionId) {
      try {
        const history = await getMemory().getHistory(`CONV#${userId}#${sessionId}`, {
          workspaceId,
        });
        return NextResponse.json({ history });
      } catch (error) {
        logger.warn(
          `[Chat API] Failed to fetch history for ${sessionId}, likely table not linked:`,
          error
        );
        return NextResponse.json({ history: [] });
      }
    } else {
      // List conversations - handle missing table gracefully
      try {
        const sessions = await getMemory().listConversations(userId, { workspaceId });
        return NextResponse.json({ sessions });
      } catch (error) {
        logger.warn('[Chat API] Failed to list conversations, likely table not linked:', error);
        return NextResponse.json({ sessions: [] });
      }
    }
  } catch (error) {
    logger.error(
      `[Chat API] GET Fatal Error: ${error instanceof Error ? error.message : String(error)}`,
      {
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        sessionId,
      }
    );
    return NextResponse.json({ error: 'Failed to fetch sessions or history' }, { status: 500 });
  }
}
