import React from 'react';
import NewAgentModal from './NewAgentModal';
import AgentToolsModal from './AgentToolsModal';
import CyberConfirm from '@/components/CyberConfirm';
import { Agent, Tool } from '@/lib/types/ui';

interface AgentModalsProps {
  showNewModal: boolean;
  setShowNewModal: (show: boolean) => void;
  showToolsModal: boolean;
  setShowToolsModal: (show: boolean) => void;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (show: boolean) => void;
  selectedAgent: Agent | null;
  availableTools: Tool[];
  onAgentCreated: () => void;
  onToolsUpdated: () => void;
  onConfirmDelete: () => void;
  t: (key: string) => string;
}

export const AgentModals: React.FC<AgentModalsProps> = ({
  showNewModal,
  setShowNewModal,
  showToolsModal,
  setShowToolsModal,
  showDeleteConfirm,
  setShowDeleteConfirm,
  selectedAgent,
  availableTools,
  onAgentCreated,
  onToolsUpdated,
  onConfirmDelete,
  t,
}) => {
  return (
    <>
      {showNewModal && (
        <NewAgentModal
          onClose={() => setShowNewModal(false)}
          onSuccess={onAgentCreated}
        />
      )}

      {showToolsModal && selectedAgent && (
        <AgentToolsModal
          agent={selectedAgent}
          availableTools={availableTools}
          onClose={() => setShowToolsModal(false)}
          onSuccess={onToolsUpdated}
        />
      )}

      <CyberConfirm
        isOpen={showDeleteConfirm}
        title={t('AGENTS_DELETE_CONFIRM_TITLE')}
        message={t('AGENTS_DELETE_CONFIRM_MSG').replace('{name}', selectedAgent?.name || '')}
        onConfirm={onConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </>
  );
};
