import React from 'react';
import NewAgentModal from './NewAgentModal';
import AgentToolsModal from './AgentToolsModal';
import CyberConfirm from '@/components/CyberConfirm';
import { Agent, Tool } from '@/lib/types/ui';
import { PROVIDERS } from '../settings/SettingsParts';

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
  // Local state for NewAgentModal which expects more controlled props
  const [newAgent, setNewAgent] = React.useState<Partial<Agent>>({
    name: '',
    id: '',
    systemPrompt: '',
    provider: '',
    model: '',
    agentType: 'llm',
    enabled: true,
  });

  const finalizeNewAgent = async () => {
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent),
      });
      if (!res.ok) throw new Error('Failed to create agent');
      onAgentCreated();
      setShowNewModal(false);
      setNewAgent({
        name: '',
        id: '',
        systemPrompt: '',
        provider: '',
        model: '',
        agentType: 'llm',
        enabled: true,
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      {showNewModal && (
        <NewAgentModal
          show={showNewModal}
          onClose={() => setShowNewModal(false)}
          newAgent={newAgent}
          setNewAgent={setNewAgent as React.Dispatch<React.SetStateAction<Partial<Agent>>>}
          finalizeNewAgent={finalizeNewAgent}
          PROVIDERS={PROVIDERS}
        />
      )}

      {showToolsModal && selectedAgent && (
        <AgentToolsModal
          selectedAgentIdForTools={selectedAgent.id}
          agents={{ [selectedAgent.id]: selectedAgent }}
          allTools={availableTools}
          loadingTools={false}
          searchQuery=""
          setSearchQuery={() => {}}
          setSelectedAgentIdForTools={() => setShowToolsModal(false)}
          handleToggleTool={async (agentId, toolName) => {
            // Logic to toggle tool
            const isAdding = !selectedAgent.tools?.includes(toolName);
            const newTools = isAdding
              ? [...(selectedAgent.tools || []), toolName]
              : (selectedAgent.tools || []).filter((t) => t !== toolName);

            await fetch(`/api/agents/${agentId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tools: newTools }),
            });
            onToolsUpdated();
          }}
          isUpdatingTools={false}
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
