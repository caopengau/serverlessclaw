'use client';

import React, { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChatSidebar } from './ChatSidebar';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { QueuedMessagesList } from './QueuedMessages';
import { useChatMessages } from './useChatMessages';
import { useKeyboardShortcuts, type ShortcutDefinition } from '@/hooks/useKeyboardShortcuts';
import { useTranslations } from '@/components/Providers/TranslationsProvider';
import { useUICommand } from '@/components/Providers/UICommandProvider';
import { useChatConnection } from './useChatConnection';
import { ChatHeader } from './ChatHeader';
import { ContextPanel } from './ContextPanel';
import { MissionControlHUD } from './MissionControlHUD';
import { MissionBriefing } from './MissionBriefing';
import { CHAT_STYLES } from './ChatStyles';
import { ChatOverlays } from './ChatOverlays';
import { useChatState } from './useChatState';
import { useChatSessionHandlers } from './useChatSessionHandlers';

/**
 * Main interface for the chat dashboard.
 * Manages chat messages, sessions, file uploads, and session settings.
 */
export default function ChatContent() {
  const { t } = useTranslations();
  const { setActiveModal, activeModal } = useUICommand();
  const router = useRouter();

  const state = useChatState();
  const {
    activeWorkspaceId,
    input, setInput,
    isLoading, setIsLoading,
    activeSessionId, setActiveSessionId,
    isShaking, setIsShaking,
    isDragging, setIsDragging,
    searchQuery, setSearchQuery,
    isEditingTitle, setIsEditingTitle,
    editedTitle, setEditedTitle,
    isAgentSelectorOpen, setIsAgentSelectorOpen,
    isInviteSelectorOpen, setIsInviteSelectorOpen,
    currentAgentId, setCurrentAgentId,
    activeCollaborators, setActiveCollaborators,
    collaborationId, setCollaborationId,
    showDeleteConfirm, setShowDeleteConfirm,
    showDeleteAllConfirm, setShowDeleteAllConfirm,
    sessionToDelete, setSessionToDelete,
    showThinking, setShowThinking,
    isChatSidebarCollapsed, setIsChatSidebarCollapsed,
    warRoomMode, setWarRoomMode,
    scrollRef,
    searchInputRef,
    chatInputRef,
    fileInputRef,
    isPostInFlight,
    seenMessageIds,
    skipNextHistoryFetch,
    activeSessionRef,
  } = state;

  const { sessions, fetchSessions, isRealtimeActive, isTransiting, setIsTransiting } =
    useChatConnection(activeWorkspaceId);

  const {
    messages,
    attachments,
    handleFiles,
    removeAttachment,
    sendMessage,
    handleToolApproval,
    handleToolRejection,
    handleToolClarification,
    handleTaskCancellation,
  } = useChatMessages({
    activeSessionId,
    setActiveSessionId,
    setIsLoading,
    isPostInFlight,
    seenMessageIds,
    fetchSessions,
    skipNextHistoryFetch,
    activeSessionRef,
    workspaceId: activeWorkspaceId
  });

  const {
    saveTitle,
    togglePin,
    createNewChat,
    handleInviteAgent,
    deleteSession,
    handleEditQueuedMessage,
    handleRemoveQueuedMessage,
  } = useChatSessionHandlers({
    activeSessionId,
    setActiveSessionId,
    fetchSessions,
    router,
    seenMessageIds,
    setCurrentAgentId,
    setActiveCollaborators,
    setCollaborationId,
    setIsAgentSelectorOpen,
    setIsShaking,
    currentAgentId,
    setSessionToDelete,
    setShowDeleteConfirm,
  });

  const shortcuts: ShortcutDefinition[] = useMemo(
    () => [
      { keys: '/', handler: () => searchInputRef.current?.focus() },
      { keys: 'i', handler: () => chatInputRef.current?.focus() },
      { keys: '?', handler: () => setActiveModal(activeModal === 'shortcuts' ? null : 'shortcuts') },
    ],
    [setActiveModal, activeModal, searchInputRef, chatInputRef]
  );
  useKeyboardShortcuts(shortcuts);

  const currentSession = useMemo(
    () => sessions.find((s) => s.sessionId === activeSessionId),
    [sessions, activeSessionId]
  );

  const pendingMessages = useMemo(
    () => currentSession?.pendingMessages || [],
    [currentSession]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, [setIsDragging]);

  const handleDragLeave = useCallback(() => setIsDragging(false), [setIsDragging]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) handleFiles(Array.from(e.dataTransfer.files));
  }, [setIsDragging, handleFiles]);

  const confirmDelete = async () => {
    if (!sessionToDelete) return;
    await fetch(`/api/chat?sessionId=${sessionToDelete}`, { method: 'DELETE' });
    setShowDeleteConfirm(false);
    if (sessionToDelete === activeSessionId) {
      setActiveSessionId('');
    }
    fetchSessions();
  };

  const confirmDeleteAll = async () => {
    await fetch('/api/chat?sessionId=all', { method: 'DELETE' });
    setShowDeleteAllConfirm(false);
    setActiveSessionId('');
    fetchSessions();
  };

  const [isContextPanelOpen, setIsContextPanelOpen] = React.useState(false);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSessionSelect={(id) => {
          if (activeSessionId !== id) {
            setActiveSessionId(id);
          }
        }}
        onNewChat={createNewChat}
        onDeleteSession={deleteSession}
        onDeleteAll={() => setShowDeleteAllConfirm(true)}
        onTogglePin={togglePin}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchInputRef={searchInputRef}
        isCollapsed={isChatSidebarCollapsed}
        onToggleCollapse={() => setIsChatSidebarCollapsed(!isChatSidebarCollapsed)}
      />

      <main
        className={`flex-1 flex flex-col min-w-0 overflow-y-hidden ${CHAT_STYLES.GRADIENTS.MAIN_BG} transition-colors relative ${isDragging ? CHAT_STYLES.GRADIENTS.DRAG_OVER : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <ChatHeader
          activeSessionId={activeSessionId}
          currentSession={currentSession}
          isEditingTitle={isEditingTitle}
          setIsEditingTitle={setIsEditingTitle}
          editedTitle={editedTitle}
          setEditedTitle={setEditedTitle}
          saveTitle={saveTitle}
          activeCollaborators={activeCollaborators}
          currentAgentId={currentAgentId}
          collaborationId={collaborationId}
          setIsInviteSelectorOpen={setIsInviteSelectorOpen}
          showThinking={showThinking}
          setShowThinking={setShowThinking}
          isRealtimeActive={isRealtimeActive}
          isContextPanelOpen={isContextPanelOpen}
          setIsContextPanelOpen={setIsContextPanelOpen}
          t={t}
          warRoomMode={warRoomMode}
          setWarRoomMode={setWarRoomMode}
        />

        <div className="flex-1 flex overflow-hidden">
          {warRoomMode && (
            <MissionBriefing
              key={`briefing-${activeSessionId}`}
              sessionId={activeSessionId}
              collaborators={activeCollaborators}
              mission={currentSession?.mission}
              t={t}
            />
          )}

          <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out">
            <ChatMessageList
              messages={messages}
              isLoading={isLoading}
              scrollRef={scrollRef}
              onOptionClick={(v) => sendMessage(v, { agentId: currentAgentId, force: true })}
              showThinking={showThinking}
              onToolApproval={handleToolApproval}
              onToolRejection={handleToolRejection}
              onToolClarification={handleToolClarification}
              onTaskCancellation={handleTaskCancellation}
            />

            <ChatInput
              input={input}
              setInput={setInput}
              isLoading={isLoading}
              onSend={(e) => {
                e.preventDefault();
                sendMessage(input, {
                  agentId: currentAgentId,
                  collaborationId: collaborationId || undefined,
                  profile: showThinking ? 'thinking' : 'fast',
                });
                setInput('');
              }}
              attachments={attachments}
              onRemoveAttachment={removeAttachment}
              fileInputRef={fileInputRef}
              onFileSelect={(e) => {
                if (e.target.files) handleFiles(Array.from(e.target.files));
              }}
              isShaking={isShaking}
              chatInputRef={chatInputRef}
            />
          </div>

          {warRoomMode && (
            <MissionControlHUD
              key={`control-${activeSessionId}`}
              sessionId={activeSessionId}
              mission={currentSession?.mission}
            />
          )}
        </div>

        {pendingMessages.length > 0 && (
          <div className="px-6 pb-4">
            <QueuedMessagesList
              messages={pendingMessages as any}
              onEdit={handleEditQueuedMessage}
              onRemove={handleRemoveQueuedMessage}
            />
          </div>
        )}

        <ChatOverlays
          isDragging={isDragging}
          t={t}
          isAgentSelectorOpen={isAgentSelectorOpen}
          isInviteSelectorOpen={isInviteSelectorOpen}
          isTransiting={isTransiting}
          activeCollaborators={activeCollaborators}
          activeSessionId={activeSessionId}
          showDeleteConfirm={showDeleteConfirm}
          showDeleteAllConfirm={showDeleteAllConfirm}
          createNewChat={createNewChat}
          handleInviteAgent={(id) => handleInviteAgent(id, setIsTransiting)}
          confirmDelete={confirmDelete}
          confirmDeleteAll={confirmDeleteAll}
          setIsAgentSelectorOpen={setIsAgentSelectorOpen}
          setIsInviteSelectorOpen={setIsInviteSelectorOpen}
          setShowDeleteConfirm={setShowDeleteConfirm}
          setShowDeleteAllConfirm={setShowDeleteAllConfirm}
        />
      </main>

      <ContextPanel
        isOpen={isContextPanelOpen}
        onClose={() => setIsContextPanelOpen(false)}
        sessionId={activeSessionId}
      />
    </div>
  );
}
