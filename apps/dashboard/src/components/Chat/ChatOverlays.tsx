import React from 'react';
import { Paperclip } from 'lucide-react';
import Typography from '@/components/ui/Typography';
import CyberConfirm from '@/components/CyberConfirm';
import { AgentSelector } from './AgentSelector';
import { CHAT_STYLES } from './ChatStyles';

interface ChatOverlaysProps {
  isDragging: boolean;
  t: (key: string) => string;
  isAgentSelectorOpen: boolean;
  isInviteSelectorOpen: boolean;
  isTransiting: boolean;
  activeCollaborators: string[];
  showDeleteConfirm: boolean;
  showDeleteAllConfirm: boolean;
  createNewChat: (agentId?: string) => void;
  handleInviteAgent: (agentId: string) => void;
  confirmDelete: () => void;
  confirmDeleteAll: () => void;
  setIsAgentSelectorOpen: (open: boolean) => void;
  setIsInviteSelectorOpen: (open: boolean) => void;
  setShowDeleteConfirm: (open: boolean) => void;
  setShowDeleteAllConfirm: (open: boolean) => void;
}

export const ChatOverlays: React.FC<ChatOverlaysProps> = ({
  isDragging,
  t,
  isAgentSelectorOpen,
  isInviteSelectorOpen,
  isTransiting,
  activeCollaborators,
  showDeleteConfirm,
  showDeleteAllConfirm,
  createNewChat,
  handleInviteAgent,
  confirmDelete,
  confirmDeleteAll,
  setIsAgentSelectorOpen,
  setIsInviteSelectorOpen,
  setShowDeleteConfirm,
  setShowDeleteAllConfirm,
}) => {
  return (
    <>
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-cyber-green/10 border-2 border-dashed border-cyber-green pointer-events-none">
          <div
            className={`flex flex-col items-center gap-4 bg-background/80 p-12 rounded-2xl border border-cyber-green/30 ${CHAT_STYLES.SHADOWS.DROP_ZONE}`}
          >
            <Paperclip size={64} className={`text-cyber-green ${CHAT_STYLES.ANIMATIONS.BOUNCE}`} />
            <Typography variant="h2" weight="bold" color="primary" glow>
              {t('CHAT_DROP_FILES')}
            </Typography>
          </div>
        </div>
      )}

      {isAgentSelectorOpen && (
        <AgentSelector
          onSelect={createNewChat}
          onClose={() => setIsAgentSelectorOpen(false)}
          title={t('CHAT_SIDEBAR_NEW_CHAT')}
        />
      )}

      {isInviteSelectorOpen && (
        <AgentSelector
          onSelect={handleInviteAgent}
          onClose={() => setIsInviteSelectorOpen(false)}
          title={t('INVITE_AGENT')}
          excludeIds={activeCollaborators}
        />
      )}

      {isTransiting && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-2 border-cyber-blue/20 border-t-cyber-blue rounded-full animate-spin" />
            <Typography
              variant="mono"
              color="primary"
              className="text-xs uppercase tracking-[0.2em] animate-pulse text-cyber-blue"
            >
              Initiating_Collaboration_Protocol...
            </Typography>
          </div>
        </div>
      )}

      <CyberConfirm
        isOpen={showDeleteConfirm}
        title={t('CHAT_DELETE_CONVERSATION')}
        message={t('CHAT_DELETE_CONFIRM')}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="warning"
      />
      <CyberConfirm
        isOpen={showDeleteAllConfirm}
        title={t('CHAT_PURGE_ALL_HISTORY')}
        message={t('CHAT_PURGE_WARNING')}
        onConfirm={confirmDeleteAll}
        onCancel={() => setShowDeleteAllConfirm(false)}
        variant="danger"
      />
    </>
  );
};
