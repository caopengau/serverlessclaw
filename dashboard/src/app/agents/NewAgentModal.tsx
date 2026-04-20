'use client';

import React from 'react';
import { Plus, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import CyberSelect from '@/components/CyberSelect';
import { useTranslations } from '@/components/Providers/TranslationsProvider';

import { Agent, ProviderModel } from '@/lib/types/ui';

interface Props {
  show: boolean;
  onClose: () => void;
  newAgent: Partial<Agent>;
  setNewAgent: React.Dispatch<React.SetStateAction<Partial<Agent>>>;
  finalizeNewAgent: () => void;
  PROVIDERS: Record<string, ProviderModel>;
}

export default function NewAgentModal({
  show,
  onClose,
  newAgent,
  setNewAgent,
  finalizeNewAgent,
  PROVIDERS,
}: Props) {
  const { t } = useTranslations();
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
    >
      <Card
        variant="solid"
        padding="lg"
        className="max-w-2xl w-full shadow-[0_0_50px_rgba(0,0,0,0.5)] space-y-6 relative"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white p-0 h-auto"
          icon={<X size={20} />}
        />

        <div className="flex items-center gap-4 text-cyber-green">
          <Plus size={32} />
          <Typography variant="h2" color="primary" weight="black" uppercase className="italic">
            {t('AGENTS_NEW_AGENT_CONFIG')}
          </Typography>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Typography
                variant="mono"
                weight="bold"
                color="white"
                uppercase
                className="text-[10px] opacity-50"
              >
                {t('AGENTS_NAME')}
              </Typography>
              <input
                value={newAgent.name}
                onChange={(e) => setNewAgent((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full bg-black/40 border border-white/10 rounded p-3 text-sm text-white outline-none focus:border-cyber-green/50 transition-all font-mono"
                placeholder="e.g. Security Auditor"
              />
            </div>
            <div className="space-y-2">
              <Typography
                variant="mono"
                weight="bold"
                color="white"
                uppercase
                className="text-[10px] opacity-50"
              >
                {t('AGENTS_SYSTEM_ID_IMMUTABLE')}
              </Typography>
              <input
                value={newAgent.id}
                onChange={(e) =>
                  setNewAgent((prev) => ({
                    ...prev,
                    id: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                  }))
                }
                className="w-full bg-black/40 border border-white/10 rounded p-3 text-sm text-white outline-none focus:border-cyber-green/50 transition-all font-mono"
                placeholder="e.g. auditor_01"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Typography
              variant="mono"
              weight="bold"
              color="white"
              uppercase
              className="text-[10px] opacity-50"
            >
              {t('AGENTS_SYSTEM_INSTRUCTIONS_FULL')}
            </Typography>
            <textarea
              value={newAgent.systemPrompt}
              onChange={(e) => setNewAgent((prev) => ({ ...prev, systemPrompt: e.target.value }))}
              className="w-full bg-black/40 border border-white/10 rounded p-4 text-xs text-white/90 font-mono min-h-[220px] outline-none focus:border-cyber-green/50 transition-all leading-relaxed custom-scrollbar"
              placeholder={t('AGENTS_SYSTEM_INSTRUCTIONS_PLACEHOLDER')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Typography
                variant="mono"
                weight="bold"
                color="white"
                uppercase
                className="text-[10px] opacity-50"
              >
                {t('AGENTS_INITIAL_PROVIDER')}
              </Typography>
              <CyberSelect
                value={newAgent.provider ?? ''}
                onChange={(val) => setNewAgent((prev) => ({ ...prev, provider: val, model: '' }))}
                options={[
                  { value: '', label: 'SYSTEM_DEFAULT' },
                  ...Object.entries(PROVIDERS).map(([id, p]) => ({ value: id, label: p.label })),
                ]}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Typography
                variant="mono"
                weight="bold"
                color="white"
                uppercase
                className="text-[10px] opacity-50"
              >
                {t('AGENTS_INITIAL_MODEL')}
              </Typography>
              <CyberSelect
                value={newAgent.model ?? ''}
                onChange={(val) => setNewAgent((prev) => ({ ...prev, model: val }))}
                options={
                  newAgent.provider
                    ? PROVIDERS[newAgent.provider as keyof typeof PROVIDERS]?.models.map(
                        (m: string) => ({ value: m, label: m })
                      )
                    : []
                }
                disabled={!newAgent.provider}
                placeholder="SELECT_MODEL"
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <Button
            onClick={finalizeNewAgent}
            variant="primary"
            size="lg"
            uppercase
            fullWidth
            className="shadow-[0_0_20px_rgba(0,255,163,0.2)] hover:scale-[1.02]"
          >
            {t('AGENTS_AUTHORIZE_INITIALIZATION')}
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            size="lg"
            uppercase
            className="px-8 text-white/60"
          >
            {t('COMMON_CANCEL')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
