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
 * Handles chat messages from the dashboard UI using the Manager agent
 *
 * @param req - The incoming POST request with chat message body.
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
    const isStream = req.nextUrl.searchParams.get('stream') === 'true';
    const userId = getUserId(req);

    const storageId = sessionId ? `CONV#${userId}#${sessionId}` : userId;

    if (!text && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { error: UI_STRINGS.MISSING_MESSAGE },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    console.log(
      `[Chat API] POST request - text: ${text?.substring(0, 20)}..., sessionId: ${sessionId}, attachments: ${attachments?.length ?? 0}, stream: ${isStream}`
    );

    const config = await AgentRegistry.getAgentConfig(AgentType.SUPERCLAW);
    const agentTools = await getAgentTools(AgentType.SUPERCLAW);
    const agent = new Agent(
      memory,
      provider,
      agentTools,
      config?.systemPrompt ?? SUPERCLAW_SYSTEM_PROMPT,
      config ?? undefined
    );

    if (isStream) {
      const encoder = new TextEncoder();
      const customStream = new ReadableStream({
        async start(controller) {
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
          let streamToolCalls: unknown[] | undefined;
          let streamMessageId: string | undefined;
          let fallbackResult: { responseText?: string; thought?: string; tool_calls?: unknown[]; traceId?: string } | null = null;

          let chunkCount = 0;
          try {
            for await (const chunk of stream) {
              chunkCount++;
              if (!streamMessageId && chunk.messageId) {
                streamMessageId = chunk.messageId;
              }
              if (chunk.content) finalResponse += chunk.content;
              if (chunk.thought) finalThought += chunk.thought;
              if (chunk.tool_calls) streamToolCalls = chunk.tool_calls;
              
              // Skip chunks that don't contain any useful payloads for the frontend
              if (!chunk.content && !chunk.thought && !chunk.tool_calls) {
                continue;
              }

              if (chunkCount % 5 === 0 || chunk.tool_calls) {
                console.log(`[Chat API] Stream chunk ${chunkCount}: content length=${chunk.content?.length || 0}, thought length=${chunk.thought?.length || 0}, tool_calls=${chunk.tool_calls?.length || 0}`);
              }

              const payloadStr = JSON.stringify({
                type: 'chunk',
                messageId: streamMessageId || (clientTraceId ? `${clientTraceId}-superclaw` : undefined),
                message: chunk.content,
                thought: chunk.thought,
                isThought: !!chunk.thought && !chunk.content,
                toolCalls: chunk.tool_calls,
                agentName: chunk.agentName || 'SuperClaw',
              }) + '\n';
              
              if (chunkCount === 1) {
                console.log(`[Chat API] Sending first chunk payload: ${payloadStr.substring(0, 150)}...`);
              }
              
              controller.enqueue(encoder.encode(payloadStr));
            }

            const streamProducedAnything = 
              finalResponse.trim().length > 0 || 
              finalThought.trim().length > 0 || 
              (streamToolCalls && streamToolCalls.length > 0);

            if (!streamProducedAnything) {
              console.warn(`[Chat API] Stream produced no content. Triggering fallback. Text length: ${text?.length || 0}`);
              fallbackResult = await agent.process(storageId, text ?? '', {
                sessionId,
                source: TraceSource.DASHBOARD,
                attachments,
                approvedToolCalls,
                traceId: clientTraceId || undefined,
                pageContext,
                skipUserSave: true,
              });
              finalResponse = fallbackResult.responseText ?? '';
              finalThought = fallbackResult.thought ?? '';
              streamToolCalls = fallbackResult.tool_calls;
            }

            if (sessionId) {
              await memory.saveConversationMeta(userId, sessionId, {
                lastMessage:
                  finalResponse.length > 60 ? finalResponse.substring(0, 60) + '...' : finalResponse,
                updatedAt: Date.now(),
              });
            }

            const fallbackTraceId = fallbackResult?.traceId;
            const finalMessageId = streamMessageId || (fallbackTraceId ? `${fallbackTraceId}-superclaw` : (clientTraceId ? `${clientTraceId}-superclaw` : undefined));
            
            console.log(`[Chat API] Final response: length=${finalResponse.length}, ID=${finalMessageId}, thought=${!!finalThought}`);

            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'final',
              data: {
                reply: finalResponse,
                thought: finalThought,
                agentName: 'SuperClaw',
                tool_calls: streamToolCalls,
                messageId: finalMessageId,
                traceId: fallbackTraceId || clientTraceId,
              }
            }) + '\n'));
          } catch (e) {
            console.error('[Chat API] Stream loop error:', e);
            controller.enqueue(encoder.encode(JSON.stringify({
              type: 'error',
              error: e instanceof Error ? e.message : String(e),
            }) + '\n'));
          } finally {
            controller.close();
          }
        }
      });

      return new NextResponse(customStream, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Transfer-Encoding': 'chunked',
        },
      });
    }

    const {
      responseText,
      thought: resultThought,
      attachments: resultAttachments,
      tool_calls: resultToolCalls,
      traceId,
    } = await agent.process(storageId, text ?? '', {
      sessionId,
      source: TraceSource.DASHBOARD,
      attachments,
      approvedToolCalls,
      pageContext,
    });

    // Update conversation metadata for the sidebar
    if (sessionId) {
      await memory.saveConversationMeta(userId, sessionId, {
        lastMessage:
          responseText.length > 60 ? responseText.substring(0, 60) + '...' : responseText,
        updatedAt: Date.now(),
      });
    }

    return NextResponse.json({
      reply: responseText,
      thought: resultThought,
      agentName: 'SuperClaw',
      attachments: resultAttachments,
      tool_calls: resultToolCalls,
      messageId: traceId ? `${traceId}-superclaw` : undefined,
    });
  } catch (error) {
    console.error(UI_STRINGS.API_CHAT_ERROR, error);

    // Persist error to history if we have sessionId
    try {
        const { sessionId, traceId: clientTraceId } = await req.clone().json();
        if (sessionId) {
          const userId = getUserId(req);
          const storageId = `CONV#${userId}#${sessionId}`;
          await memory.addMessage(storageId, {
            role: MessageRole.ASSISTANT,
            content: AGENT_ERRORS.PROCESS_FAILURE,
            traceId: clientTraceId || `error-${Date.now()}`,
            messageId: `err-${Math.random().toString(36).substring(2, 9)}`,
          });
        }
    } catch (e) {
      console.error('Failed to persist error message:', e);
    }

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
      // Return history for a specific session
      const history = await memory.getHistory(`CONV#${userId}#${sessionId}`);
      return NextResponse.json({ history });
    } else {
      // Return list of sessions
      const sessions = await memory.listConversations(userId);
      console.log(`[Chat API] Returning ${sessions.length} sessions to frontend`);
      return NextResponse.json({ sessions });
    }
  } catch {
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}
