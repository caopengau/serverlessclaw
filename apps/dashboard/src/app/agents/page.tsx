'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import Typography from '@/components/ui/Typography';
import Card from '@/components/ui/Card';
import AgentTable from './AgentTable';
import Skeleton from '@/components/ui/Skeleton';
import { Tool, Agent } from '@/lib/types/ui';
import PageHeader from '@/components/PageHeader';
import { useRealtime, RealtimeMessage } from '@/hooks/useRealtime';
import { useTranslations } from '@/components/Providers/TranslationsProvider';
import { logger } from '@claw/core/lib/logger';
import { AgentStats } from './AgentStats';
import { AgentModals } from './AgentModals';

export default function AgentsPage() {
  const { t } = useTranslations();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (error) {
      logger.error('Failed to fetch agents:', error);
      toast.error(t('AGENTS_FETCH_ERROR'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchTools = useCallback(async () => {
    try {
      const res = await fetch('/api/tools');
      const data = await res.json();
      setAvailableTools(data.tools || []);
    } catch (error) {
      logger.error('Failed to fetch tools:', error);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchTools();
  }, [fetchAgents, fetchTools]);

  const handleRealtimeMessage = useCallback(
    (_topic: string, message: RealtimeMessage) => {
      if (
        message['detail-type'] === 'agent_updated' ||
        message['detail-type'] === 'agent_created'
      ) {
        fetchAgents();
      }
    },
    [fetchAgents]
  );

  useRealtime({
    topics: ['agents/+/config'],
    onMessage: handleRealtimeMessage,
  });

  const updateAgent = async (id: string, updates: Partial<Agent>) => {
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error('Failed to update agent');

      setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));

      if (updates.enabled !== undefined) {
        toast.success(updates.enabled ? t('AGENTS_ENABLED_SUCCESS') : t('AGENTS_DISABLED_SUCCESS'));
      } else {
        toast.success(t('AGENTS_UPDATE_SUCCESS'));
      }
    } catch (error) {
      logger.error('Failed to update agent:', error);
      toast.error(t('AGENTS_UPDATE_ERROR'));
    }
  };

  const deleteAgent = async () => {
    if (!selectedAgent) return;
    try {
      const res = await fetch(`/api/agents/${selectedAgent.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete agent');

      setAgents((prev) => prev.filter((a) => a.id !== selectedAgent.id));
      setShowDeleteConfirm(false);
      setSelectedAgent(null);
      toast.success(t('AGENTS_DELETE_SUCCESS'));
    } catch (error) {
      logger.error('Failed to delete agent:', error);
      toast.error(t('AGENTS_DELETE_ERROR'));
    }
  };

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 space-y-10">
      <PageHeader
        titleKey="AGENTS_TITLE"
        subtitleKey="AGENTS_SUBTITLE"
        stats={<AgentStats agents={agents} t={t} />}
      >
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowNewModal(true)}
          icon={<Plus size={14} />}
        >
          {t('AGENTS_CREATE_NEW')}
        </Button>
      </PageHeader>

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-more h-4 w-4" />
            <input
              type="text"
              placeholder={t('AGENTS_SEARCH_PLACEHOLDER')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-input border border-input rounded-full py-2 pl-10 pr-4 text-sm focus:border-cyber-blue outline-none transition-all"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLoading(true);
              fetchAgents();
            }}
            icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
          >
            {t('REFRESH')}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredAgents.length > 0 ? (
          <Card variant="glass" padding="none" className="overflow-hidden">
            <AgentTable
              agents={filteredAgents}
              updateAgent={updateAgent}
              deleteAgent={(id) => {
                const agent = agents.find((a) => a.id === id);
                if (agent) {
                  setSelectedAgent(agent);
                  setShowDeleteConfirm(true);
                }
              }}
              cloneAgent={(id) => {
                const agent = agents.find((a) => a.id === id);
                if (agent) {
                  // Implement clone logic or just toast
                  toast.info(`Cloning agent ${agent.name}...`);
                }
              }}
              setSelectedAgentIdForTools={(id) => {
                const agent = agents.find((a) => a.id === id);
                if (agent) {
                  setSelectedAgent(agent);
                  setShowToolsModal(true);
                }
              }}
              onSave={() => {}}
              saving={false}
              hasChanges={false}
            />
          </Card>
        ) : (
          <Card
            variant="solid"
            padding="lg"
            className="h-48 flex flex-col items-center justify-center opacity-20 border-dashed"
          >
            <Typography variant="body">{t('AGENTS_NONE_FOUND')}</Typography>
          </Card>
        )}
      </div>

      <AgentModals
        showNewModal={showNewModal}
        setShowNewModal={setShowNewModal}
        showToolsModal={showToolsModal}
        setShowToolsModal={setShowToolsModal}
        showDeleteConfirm={showDeleteConfirm}
        setShowDeleteConfirm={setShowDeleteConfirm}
        selectedAgent={selectedAgent}
        availableTools={availableTools}
        onAgentCreated={fetchAgents}
        onToolsUpdated={fetchAgents}
        onConfirmDelete={deleteAgent}
        t={t}
      />
    </div>
  );
}
