import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { UI_STRINGS, AUTH } from '@/lib/constants';
import { HTTP_STATUS, AGENT_ERRORS } from '@claw/core/lib/constants';
import { revalidatePath } from 'next/cache';

// Re-usable instances for optimization
import { DynamoMemory, CachedMemory } from '@claw/core/lib/memory';
import { ProviderManager } from '@claw/core/lib/providers/index';
import { getAgentTools } from '@claw/core/tools/index';
import { Agent } from '@claw/core/lib/agent';
import { SUPERCLAW_SYSTEM_PROMPT } from '@claw/core/agents/superclaw';
import { TraceSource, AgentType, MessageRole } from '@claw/core/lib/types/index';
import { AgentRegistry } from '@claw/core/lib/registry';

// Singleton memory and provider to leverage in-memory LRU cache
const memory = new CachedMemory(new DynamoMemory());
const provider = new ProviderManager();

function getUserId(req: NextRequest): string {
  if (!req.cookies) {
    return 'dashboard-user';
  }
  const sessionCookie = req.cookies.get(AUTH.SESSION_USER_ID);
  return sessionCookie?.value || 'dashboard-user';
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
    } = await req.json();
    
    const userId = getUserId(req);
    const storageId = sessionId ? `CONV#${userId}#${sessionId}` : userId;

    if (!text && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { error: UI_STRINGS.MISSING_MESSAGE },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    console.log(`[Chat API] POST - userId: ${userId}, sessionId: ${sessionId}, traceId: ${clientTraceId}`);

    const config = await AgentRegistry.getAgentConfig(AgentType.SUPERCLAW);
    const agentTools = await getAgentTools(AgentType.SUPERCLAW);
    const agent = new Agent(
      memory,
      provider,
      agentTools,
      config?.systemPrompt ?? SUPERCLAW_SYSTEM_PROMPT,
      config ?? undefined
    );

    // We use the streaming generator to trigger real-time MQTT emissions via AgentEmitter
    // while the request remains open. Chunks are automatically sent to the dashboard via IoT Core.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = agent.stream(storageId, text ?? '', {
      sessionId,
      source: TraceSource.DASHBOARD,
      attachments,
      approvedToolCalls,
      traceId: clientTraceId || undefined,
      pageContext,
    });

    let finalResponse = '';
    let finalThought = '';
    let finalToolCalls: ToolCall[] | undefined;
    let finalMessageId = '';

    for await (const chunk of stream) {
      if (chunk.content) finalResponse += chunk.content;
      if (chunk.thought) finalThought += chunk.thought;
      if (chunk.tool_calls) finalToolCalls = chunk.tool_calls;
      if (chunk.messageId) finalMessageId = chunk.messageId;
    }

    console.log(`[Chat API] Stream finished - sessionId: ${sessionId}, response length: ${finalResponse.length}, thought length: ${finalThought.length}`);

    // Update conversation metadata for the sidebar
    if (sessionId) {
      await memory.saveConversationMeta(userId, sessionId, {
        lastMessage:
          finalResponse.length > 60 ? finalResponse.substring(0, 60) + '...' : finalResponse,
        updatedAt: Date.now(),
      });
    }

    return NextResponse.json({
      reply: finalResponse.trim(),
      thought: finalThought.trim(),
      agentName: 'SuperClaw',
      messageId: finalMessageId,
      tool_calls: finalToolCalls,
    });
  } catch (error) {
    console.error(UI_STRINGS.API_CHAT_ERROR, error);
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
    const { sessionId, title, isPinned } = await req.json();
    const userId = getUserId(req);

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    await memory.saveConversationMeta(userId, sessionId, {
      title,
      isPinned,
      updatedAt: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update session:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

/**
 * Deletes one or all conversation sessions
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId');
    const userId = getUserId(req);

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    if (sessionId === 'all') {
      const sessions = await memory.listConversations(userId);
      await Promise.all(sessions.map((s) => memory.deleteConversation(userId, s.sessionId)));
      revalidatePath('/');
      return NextResponse.json({ success: true, count: sessions.length });
    }

    await memory.deleteConversation(userId, sessionId);
    revalidatePath('/');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete session:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}

/**
 * Retrieves chat sessions or history
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = getUserId(req);
    const sessionId = req.nextUrl.searchParams.get('sessionId');

    if (sessionId) {
      const history = await memory.getHistory(`CONV#${userId}#${sessionId}`);
      return NextResponse.json({ history });
    } else {
      const sessions = await memory.listConversations(userId);
      return NextResponse.json({ sessions });
    }
  } catch {
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}
