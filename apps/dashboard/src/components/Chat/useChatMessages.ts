import { useState, useCallback, useEffect } from 'react';
import { logger } from '@claw/core/lib/logger';
import { ChatMessage, AttachmentPreview, mergeHistoryWithMessages } from '@claw/hooks';
import { AGENT_ERRORS } from '@/lib/constants';
import {
  fetchChatHistory,
  postChatMessage,
  reportChatError,
  ChatApiResponse,
} from './chat-api-client';

export interface UseChatMessagesOptions {
  activeSessionId: string;
  setActiveSessionId: (id: string) => void;
  setIsLoading: (loading: boolean) => void;
  isPostInFlight: React.MutableRefObject<boolean>;
  seenMessageIds: React.MutableRefObject<Set<string>>;
  fetchSessions: () => void;
  skipNextHistoryFetch: React.MutableRefObject<boolean>;
  activeSessionRef: React.MutableRefObject<string>;
  workspaceId?: string | null;
  disabled?: boolean;
}

export function useChatMessages({
  activeSessionId,
  setActiveSessionId,
  setIsLoading,
  isPostInFlight,
  seenMessageIds,
  fetchSessions,
  skipNextHistoryFetch,
  activeSessionRef,
  workspaceId = null,
  disabled = false,
}: UseChatMessagesOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);

  const fetchHistory = useCallback(
    async (sessionId: string) => {
      if (!sessionId) return;
      setIsLoading(true);
      try {
        const data = await fetchChatHistory(sessionId, workspaceId);
        if (data.history) {
          setMessages((prev: ChatMessage[]) => {
            const { messages: mergedMessages, seenIds } = mergeHistoryWithMessages(
              prev,
              data.history
            );
            seenIds.forEach((id) => seenMessageIds.current.add(id));
            return mergedMessages;
          });
        }
      } catch (error) {
        logger.error('Failed to fetch history:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [setIsLoading, seenMessageIds, workspaceId]
  );

  useEffect(() => {
    if (disabled) return;
    if (activeSessionId) {
      if (skipNextHistoryFetch.current) {
        skipNextHistoryFetch.current = false;
        fetchHistory(activeSessionId);
        return;
      }
      setMessages([]);
      seenMessageIds.current.clear();
      fetchHistory(activeSessionId);
    } else {
      setMessages([]);
      seenMessageIds.current.clear();
    }
  }, [activeSessionId, disabled, fetchHistory, seenMessageIds, skipNextHistoryFetch]);

  const updateAssistantResponse = useCallback(
    (data: ChatApiResponse, tempId: string) => {
      const targetId = data.messageId || tempId;
      seenMessageIds.current.add(targetId);
      setMessages((prev: ChatMessage[]) => {
        let existingIdx = prev.findIndex(
          (m: ChatMessage) => m.messageId === targetId && m.role === 'assistant'
        );
        if (existingIdx === -1) {
          existingIdx = prev.findIndex((m: ChatMessage) => m.role === 'assistant' && m.isThinking);
        }

        if (existingIdx !== -1) {
          const existing = prev[existingIdx];
          const updated = [...prev];
          updated[existingIdx] = {
            ...existing,
            content: data.reply || existing.content,
            thought:
              data.thought && data.thought.length > (existing.thought?.length ?? 0)
                ? data.thought
                : existing.thought || data.thought,
            tool_calls: data.tool_calls || existing.tool_calls,
            agentName: data.agentName || existing.agentName,
            ui_blocks: data.ui_blocks || existing.ui_blocks,
            isThinking: false,
            modelName: data.model || existing.modelName,
            usage: data.usage || existing.usage,
          };
          return updated;
        }
        return [
          ...prev,
          {
            role: 'assistant',
            content: data.reply || (data.tool_calls ? 'Executing tools...' : ''),
            thought: data.thought || '',
            messageId: targetId,
            agentName: data.agentName || 'SuperClaw',
            tool_calls: data.tool_calls || [],
            ui_blocks: data.ui_blocks || [],
            createdAt: Date.now(),
            modelName: data.model,
            usage: data.usage,
          },
        ];
      });
    },
    [seenMessageIds]
  );

  const handleConnectionError = useCallback(
    async (sessionId: string, error: unknown) => {
      logger.error('Chat connection error:', error);
      if (sessionId === activeSessionRef.current) {
        const errorId = `error_${Date.now()}`;
        seenMessageIds.current.add(errorId);
        setMessages((prev: ChatMessage[]) => [
          ...prev,
          {
            role: 'assistant',
            content: AGENT_ERRORS.CONNECTION_FAILURE,
            agentName: 'SystemGuard',
            messageId: errorId,
            isError: true,
            thought: '',
            tool_calls: [],
            ui_blocks: [],
            attachments: [],
            options: [],
          },
        ]);
      }
      await reportChatError(sessionId, error);
    },
    [activeSessionRef, seenMessageIds]
  );

  const sendMessage = useCallback(
    async (text: string, options: Record<string, unknown> = {}) => {
      if (!text.trim() && attachments.length === 0) return;
      if (isPostInFlight.current) return;

      const userMsg = text.trim();
      const currentAttachments = [...attachments];
      const tempId = crypto.randomUUID();
      const primaryAgentId = options.agentIds?.[0] || options.agentId || 'superclaw';

      setMessages((prev: ChatMessage[]) => [
        ...prev,
        {
          role: 'user',
          content: userMsg,
          messageId: tempId,
          pageContext: options.pageContext,
          attachments: currentAttachments.map((a) => ({
            type: a.type,
            name: a.file.name,
            mimeType: a.file.type,
            url: a.preview,
          })),
          createdAt: Date.now(),
          thought: '',
          tool_calls: [],
          ui_blocks: [],
          options: [],
          agentName: 'Human',
        },
        {
          role: 'assistant',
          content: '',
          messageId: `${tempId}-${primaryAgentId}`,
          agentName: primaryAgentId,
          isThinking: true,
          createdAt: Date.now(),
          thought: '',
          tool_calls: [],
          ui_blocks: [],
          attachments: [],
          options: [],
        },
      ]);

      let currentSessionId = activeSessionRef.current;
      if (!currentSessionId) {
        currentSessionId = `session_${Date.now()}`;
        skipNextHistoryFetch.current = true;
        activeSessionRef.current = currentSessionId;
        setActiveSessionId(currentSessionId);
      }

      try {
        const apiAttachments = await Promise.all(
          currentAttachments.map(async (a) => {
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
              reader.readAsDataURL(a.file);
            });
            return { type: a.type, name: a.file.name, mimeType: a.file.type, base64 };
          })
        );

        const result = await postChatMessage({
          ...options,
          text: userMsg,
          sessionId: currentSessionId,
          attachments: apiAttachments,
          traceId: tempId,
          workspaceId: workspaceId || undefined,
        });

        if (!result.ok) {
          if (currentSessionId === activeSessionRef.current) {
            setMessages((prev: ChatMessage[]) => [
              ...prev,
              {
                role: 'assistant',
                content:
                  result.errorData?.details ||
                  result.errorData?.error ||
                  AGENT_ERRORS.PROCESS_FAILURE,
                agentName: 'SystemGuard',
                isError: true,
                thought: '',
                tool_calls: [],
                ui_blocks: [],
                attachments: [],
                options: [],
              },
            ]);
          }
          fetchSessions();
          return;
        }

        if (currentSessionId === activeSessionRef.current) {
          updateAssistantResponse(result.data, tempId);
        }
        fetchSessions();
      } catch (error) {
        handleConnectionError(currentSessionId, error);
      } finally {
        isPostInFlight.current = false;
        setIsLoading(false);
      }
    },
    [
      attachments,
      activeSessionRef,
      isPostInFlight,
      setActiveSessionId,
      workspaceId,
      fetchSessions,
      updateAssistantResponse,
      handleConnectionError,
      setIsLoading,
      skipNextHistoryFetch,
    ]
  );

  const handleToolAction = useCallback(
    async (action: string, callId: string, comment?: string) => {
      const currentSessionId = activeSessionRef.current;
      setIsLoading(true);
      isPostInFlight.current = true;
      try {
        const payload: {
          text: string;
          sessionId: string;
          workspaceId?: string;
          approvedToolCalls?: string[];
          rejectedToolCalls?: string[];
          clarifiedToolCalls?: string[];
        } = {
          text: comment || `I ${action} the tool execution.`,
          sessionId: currentSessionId,
          workspaceId: workspaceId || undefined,
        };
        if (action === 'approve') payload.approvedToolCalls = [callId];
        if (action === 'reject') payload.rejectedToolCalls = [callId];
        if (action === 'clarify') payload.clarifiedToolCalls = [callId];

        const result = await postChatMessage(payload);
        if (result.ok && currentSessionId === activeSessionRef.current) {
          updateAssistantResponse(result.data, `${action}-${callId}`);
        }
        fetchSessions();
      } catch (error) {
        logger.error(`${action} error:`, error);
      } finally {
        isPostInFlight.current = false;
        setIsLoading(false);
      }
    },
    [
      activeSessionRef,
      setIsLoading,
      isPostInFlight,
      workspaceId,
      updateAssistantResponse,
      fetchSessions,
    ]
  );

  return {
    messages,
    setMessages,
    attachments,
    setAttachments,
    fetchHistory,
    sendMessage,
    handleToolApproval: (id: string, c?: string) => handleToolAction('approve', id, c),
    handleToolRejection: (id: string, c?: string) => handleToolAction('reject', id, c),
    handleToolClarification: (id: string, c?: string) => handleToolAction('clarify', id, c),
    handleTaskCancellation: (id: string, c?: string) => handleToolAction('cancel', id, c),
    handleFiles: async (files: File[]) => {
      const newAttachments = await Promise.all(
        files.map(async (file) => {
          const type = (file.type.startsWith('image/') ? 'image' : 'file') as 'image' | 'file';
          const preview =
            type === 'image'
              ? await new Promise<string>((r) => {
                  const rd = new FileReader();
                  rd.onloadend = () => r(rd.result as string);
                  rd.readAsDataURL(file);
                })
              : '';
          return { file, preview, type };
        })
      );
      setAttachments((prev) => [...prev, ...newAttachments]);
    },
    removeAttachment: (i: number) => setAttachments((prev) => prev.filter((_, idx) => idx !== i)),
  };
}
