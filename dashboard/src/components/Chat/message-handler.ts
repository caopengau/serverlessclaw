import { ChatMessage, HistoryMessage } from './types';

/**
 * Data shape for an incoming MQTT chunk message.
 */
export interface IncomingChunk {
  sessionId?: string;
  messageId?: string;
  message?: string;
  userId?: string;
  isThought?: boolean;
  agentName?: string;
  attachments?: ChatMessage['attachments'];
  options?: ChatMessage['options'];
  toolCalls?: ChatMessage['tool_calls'];
  tool_calls?: ChatMessage['tool_calls'];
}

/**
 * Determines if an incoming MQTT chunk should be processed based on session routing.
 */
export function shouldProcessChunk(
  data: IncomingChunk,
  currentActiveId: string,
  expectedUserId: string
): boolean {
  if (data.userId !== expectedUserId) return false;
  if (!data.message && !data.isThought) return false;
  if (!data.sessionId || data.sessionId === currentActiveId) return true;
  return false;
}

/**
 * Applies an incoming MQTT chunk to the message list.
 * Returns a new messages array. Pure function, no side effects.
 */
export function applyChunkToMessages(
  prev: ChatMessage[],
  data: IncomingChunk
): ChatMessage[] {
  // Find existing message with matching messageId
  const existingIndex = prev.findIndex(
    (m) => m.messageId === data.messageId && m.role === 'assistant'
  );

  if (existingIndex !== -1) {
    const updated = [...prev];
    const existing = updated[existingIndex];
    if (data.isThought) {
      updated[existingIndex] = {
        ...existing,
        thought: (existing.thought ?? '') + (data.message ?? ''),
        options: data.options ?? existing.options,
      };
    } else {
      updated[existingIndex] = {
        ...existing,
        content: (existing.content ?? '') + (data.message ?? ''),
        attachments: data.attachments ?? existing.attachments,
        tool_calls: data.toolCalls || data.tool_calls || existing.tool_calls,
        options: data.options ?? existing.options,
      };
    }
    return updated;
  }

  // No existing message found — check for exact content duplicate
  if (data.messageId && data.message) {
    const isExactDup = prev.some(
      (m) => m.messageId === data.messageId && m.content === data.message
    );
    if (isExactDup) return prev;
  }

  // Add new message
  return [
    ...prev,
    {
      role: 'assistant',
      content: data.isThought ? '' : (data.message ?? ''),
      thought: data.isThought ? data.message : undefined,
      messageId: data.messageId,
      agentName: data.agentName ?? 'SuperClaw',
      attachments: data.attachments,
      options: data.options,
      tool_calls: data.toolCalls || data.tool_calls,
    },
  ];
}

/**
 * Maps a raw history message from the API into a ChatMessage,
 * including the critical messageId field for deduplication.
 */
export function mapHistoryMessage(m: HistoryMessage): ChatMessage {
  return {
    role: m.role === 'assistant' || m.role === 'system' ? 'assistant' : 'user',
    content: m.content,
    thought: m.thought,
    agentName: m.agentName ?? (m.role === 'assistant' || m.role === 'system' ? 'SuperClaw' : undefined),
    attachments: m.attachments,
    options: m.options,
    tool_calls: m.tool_calls,
    messageId: m.traceId,
  };
}

/**
 * Merges fetched history with the current message list.
 * Preserves streaming placeholders and local-only messages not yet in history.
 * Returns the merged messages array and a set of seen message IDs.
 */
export function mergeHistoryWithMessages(
  prev: ChatMessage[],
  rawHistory: HistoryMessage[]
): { messages: ChatMessage[]; seenIds: Set<string> } {
  const seenIds = new Set<string>();
  const history = rawHistory.map(mapHistoryMessage);

  // Track IDs from history for dedup
  history.forEach((m) => {
    if (m.messageId) seenIds.add(m.messageId);
  });

  // Detect streaming placeholders (assistant messages with empty content and a messageId)
  const streamingPlaceholders = prev.filter(
    (m) => m.role === 'assistant' && m.messageId && m.content === ''
  );

  // If there are active streaming placeholders, don't replace - just merge user messages
  if (streamingPlaceholders.length > 0) {
    const existingContent = new Set(prev.map((m) => m.content));
    const newUserMessages = history.filter(
      (m) => m.role === 'user' && !existingContent.has(m.content)
    );
    return {
      messages: [
        ...newUserMessages,
        ...prev.filter((m) => m.role === 'user' || m.role === 'assistant'),
      ],
      seenIds,
    };
  }

  // Preserve local-only messages (errors, streaming placeholders) not yet in history
  const historyIds = new Set(history.map((m) => m.messageId).filter(Boolean));
  const localOnly = prev.filter(
    (m) => m.role === 'assistant' && m.messageId && !historyIds.has(m.messageId)
  );

  return { messages: [...history, ...localOnly], seenIds };
}
