import React, { useCallback } from 'react';
import { logger } from '@claw/core/lib/logger';
import { AGENT_TYPES } from '@claw/core/lib/types/index';

interface ChatSessionHandlersProps {
  activeSessionId: string;
  setActiveSessionId: (id: string) => void;
  fetchSessions: () => void;
  router: { push: (path: string, options?: { scroll?: boolean }) => void };
  seenMessageIdsRef: React.MutableRefObject<Set<string>>;
  setCurrentAgentId: (id: string) => void;
  setActiveCollaborators: (ids: string[]) => void;
  setCollaborationId: (id: string | null) => void;
  setIsAgentSelectorOpen: (open: boolean) => void;
  setIsShaking: (shaking: boolean) => void;
  currentAgentId: string;
  setSessionToDelete: (id: string | null) => void;
  setShowDeleteConfirm: (show: boolean) => void;
}

export function useChatSessionHandlers({
  activeSessionId,
  setActiveSessionId,
  fetchSessions,
  router,
  seenMessageIdsRef,
  setCurrentAgentId,
  setActiveCollaborators,
  setCollaborationId,
  setIsAgentSelectorOpen,
  setIsShaking,
  currentAgentId,
  setSessionToDelete,
  setShowDeleteConfirm,
}: ChatSessionHandlersProps) {
  const saveTitle = useCallback(
    async (title: string) => {
      if (!activeSessionId || !title.trim()) return;
      try {
        await fetch('/api/chat', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: activeSessionId, title: title.trim() }),
        });
        fetchSessions();
        return true;
      } catch (error) {
        logger.error('Failed to save title:', error);
        return false;
      }
    },
    [activeSessionId, fetchSessions]
  );

  const togglePin = useCallback(
    async (sessionId: string, isPinned: boolean) => {
      try {
        await fetch('/api/chat', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, isPinned }),
        });
        fetchSessions();
      } catch (error) {
        logger.error('Failed to toggle pin:', error);
      }
    },
    [fetchSessions]
  );

  const createNewChat = useCallback(
    (agentId: string = AGENT_TYPES.SUPERCLAW) => {
      setCurrentAgentId(agentId);
      setActiveCollaborators([agentId]);
      setCollaborationId(null);
      setIsAgentSelectorOpen(false);

      if (!activeSessionId && agentId === currentAgentId) {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
        return;
      }

      seenMessageIdsRef.current.clear();
      setActiveSessionId('');
      router.push('/chat', { scroll: false });
    },
    [
      activeSessionId,
      currentAgentId,
      setCurrentAgentId,
      setActiveCollaborators,
      setCollaborationId,
      setIsAgentSelectorOpen,
      setIsShaking,
      seenMessageIdsRef,
      setActiveSessionId,
      router,
    ]
  );

  const handleInviteAgent = useCallback(
    async (agentId: string, setIsTransiting: (v: boolean) => void) => {
      if (activeSessionId && agentId) {
        setIsTransiting(true);
        try {
          const res = await fetch('/api/collaboration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'invite', sessionId: activeSessionId, agentId }),
          });
          if (res.ok) {
            fetchSessions();
          }
        } catch (error) {
          logger.error('Failed to invite agent:', error);
        } finally {
          setIsTransiting(false);
        }
      }
    },
    [activeSessionId, fetchSessions]
  );

  const deleteSession = useCallback(
    (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      setSessionToDelete(sessionId);
      setShowDeleteConfirm(true);
    },
    [setSessionToDelete, setShowDeleteConfirm]
  );

  const handleEditQueuedMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!activeSessionId) return;
      await fetch('/api/pending-messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId, messageId, content: newContent }),
      });
      fetchSessions();
    },
    [activeSessionId, fetchSessions]
  );

  const handleRemoveQueuedMessage = useCallback(
    async (messageId: string) => {
      if (!activeSessionId) return;
      await fetch('/api/pending-messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId, messageId }),
      });
      fetchSessions();
    },
    [activeSessionId, fetchSessions]
  );

  return {
    saveTitle,
    togglePin,
    createNewChat,
    handleInviteAgent,
    deleteSession,
    handleEditQueuedMessage,
    handleRemoveQueuedMessage,
  };
}
