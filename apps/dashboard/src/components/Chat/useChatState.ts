import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTenant } from '@/components/Providers/TenantProvider';
import { AGENT_TYPES } from '@claw/core/lib/types/index';

export function useChatState() {
  const { activeWorkspaceId } = useTenant();
  const searchParams = useSearchParams();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string>(
    () => searchParams.get('session') || ''
  );
  const [mounted, setMounted] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  const [isAgentSelectorOpen, setIsAgentSelectorOpen] = useState(false);
  const [isInviteSelectorOpen, setIsInviteSelectorOpen] = useState(false);
  const [currentAgentId, setCurrentAgentId] = useState<string>(AGENT_TYPES.SUPERCLAW);
  const [activeCollaborators, setActiveCollaborators] = useState<string[]>([AGENT_TYPES.SUPERCLAW]);
  const [collaborationId, setCollaborationId] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [showThinking, setShowThinking] = useState(true);
  const [isChatSidebarCollapsed, setIsChatSidebarCollapsed] = useState(false);
  const [warRoomMode, setWarRoomMode] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPostInFlight = useRef(false);
  const seenMessageIds = useRef<Set<string>>(new Set());
  const skipNextHistoryFetch = useRef(false);
  const activeSessionRef = useRef(searchParams.get('session') || '');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    const session = searchParams.get('session');
    if (session && session !== activeSessionRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSessionId(session);
      activeSessionRef.current = session;
    }
  }, [searchParams]);

  return {
    activeWorkspaceId,
    input,
    setInput,
    isLoading,
    setIsLoading,
    activeSessionId,
    setActiveSessionId,
    mounted,
    isShaking,
    setIsShaking,
    isDragging,
    setIsDragging,
    searchQuery,
    setSearchQuery,
    isEditingTitle,
    setIsEditingTitle,
    editedTitle,
    setEditedTitle,
    isAgentSelectorOpen,
    setIsAgentSelectorOpen,
    isInviteSelectorOpen,
    setIsInviteSelectorOpen,
    currentAgentId,
    setCurrentAgentId,
    activeCollaborators,
    setActiveCollaborators,
    collaborationId,
    setCollaborationId,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showDeleteAllConfirm,
    setShowDeleteAllConfirm,
    sessionToDelete,
    setSessionToDelete,
    showThinking,
    setShowThinking,
    isChatSidebarCollapsed,
    setIsChatSidebarCollapsed,
    warRoomMode,
    setWarRoomMode,
    scrollRef,
    searchInputRef,
    chatInputRef,
    fileInputRef,
    isPostInFlight,
    seenMessageIds,
    skipNextHistoryFetch,
    activeSessionRef,
  };
}
