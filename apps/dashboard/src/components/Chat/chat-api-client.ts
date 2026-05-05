import { ChatMessage, ToolCall, DynamicComponent } from '@claw/hooks';

export interface ChatApiResponse {
  reply?: string;
  thought?: string;
  messageId?: string;
  agentName?: string;
  tool_calls?: ToolCall[];
  error?: string;
  details?: string;
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  ui_blocks?: DynamicComponent[];
}

export async function fetchChatHistory(sessionId: string, workspaceId: string | null = null) {
  const url = new URL('/api/chat', window.location.origin);
  url.searchParams.set('sessionId', sessionId);
  if (workspaceId) url.searchParams.set('workspaceId', workspaceId);

  const response = await fetch(url.toString());
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`History fetch failed: ${response.status}`);
  }
  return response.json();
}

export async function postChatMessage(payload: Record<string, unknown>) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: 'Unknown response format' };
    }
    return { ok: false, status: response.status, errorData };
  }

  const data = await response.json();
  return { ok: true, data };
}

export async function reportChatError(sessionId: string, error: unknown) {
  try {
    await fetch('/api/memory/gap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        details: `Chat failure in session ${sessionId}. Error: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { category: 'strategic_gap', urgency: 7, impact: 5 },
      }),
    });
  } catch {
    // Ignore reporting errors
  }
}
