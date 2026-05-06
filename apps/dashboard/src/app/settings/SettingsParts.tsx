import React from 'react';
import {
  LLMProvider,
  OpenAIModel,
  BedrockModel,
  MiniMaxModel,
  OpenRouterModel,
} from '@claw/core/lib/types/llm';
import { SYSTEM_CONFIG_METADATA } from '@claw/core/lib/metadata';
import CyberTooltip from '@/components/CyberTooltip';
import Typography from '@/components/ui/Typography';
import { Zap } from 'lucide-react';

export const PROVIDERS = {
  [LLMProvider.OPENAI]: {
    label: 'OpenAI (Native)',
    models: [
      OpenAIModel.GPT_5_4,
      OpenAIModel.GPT_5_4_MINI,
      OpenAIModel.GPT_5_4_NANO,
      OpenAIModel.GPT_5_MINI,
    ],
  },
  [LLMProvider.BEDROCK]: {
    label: 'AWS Bedrock (Native)',
    models: [BedrockModel.CLAUDE_4_6],
  },
  [LLMProvider.MINIMAX]: {
    label: 'MiniMax (Native)',
    models: [MiniMaxModel.M2_7, MiniMaxModel.M2_7_HIGHSPEED],
  },
  [LLMProvider.OPENROUTER]: {
    label: 'OpenRouter (Aggregator)',
    models: [OpenRouterModel.GLM_5, OpenRouterModel.GEMINI_3_FLASH],
  },
};

export interface SystemConfig {
  provider: string;
  model: string;
  evolutionMode: string;
  optimizationPolicy: string;
  activeLocale: string;
  maxToolIterations: string | number;
  circuitBreakerThreshold: string | number;
  protectedResources: string;
  reflectionFrequency: string | number;
  strategicReviewFrequency: string | number;
  minGapsForReview: string | number;
  recursionLimit: string | number;
  deployLimit: string | number;
  escalationEnabled: string;
  protocolFallbackEnabled: string;
  consecutiveBuildFailures: number;
}

export function ConfigTooltip({ id, t }: { id: string; t: (key: string) => string }) {
  const meta = SYSTEM_CONFIG_METADATA[id];
  if (!meta) return null;

  return (
    <CyberTooltip
      content={
        <div className="space-y-2">
          <p className="text-cyber-blue font-bold uppercase text-[9px] mb-1">
            {t('SETTINGS_TOOLTIP_INTEGRATION').replace('{label}', meta.label)}
          </p>
          <p>{meta.implication}</p>
          {meta.risk && (
            <p>
              <span className="text-red-400 font-bold">{t('SETTINGS_TOOLTIP_RISK')}</span>{' '}
              {meta.risk}
            </p>
          )}
          {meta.safeguard && (
            <p>
              <span className="text-green-400 font-bold">{t('SETTINGS_TOOLTIP_SAFEGUARD')}</span>{' '}
              {meta.safeguard}
            </p>
          )}
        </div>
      }
    />
  );
}

interface SettingSectionProps {
  title: string;
  icon: React.ReactNode;
  onReset: () => void;
  resetLabel: string;
  color: 'intel' | 'primary' | 'reflect';
  children: React.ReactNode;
}

export const SettingSection: React.FC<SettingSectionProps> = ({
  title,
  icon,
  onReset,
  resetLabel,
  color,
  children,
}) => {
  return (
    <div className={`pt-8 first:pt-0 border-t first:border-t-0 border-border space-y-4`}>
      <div className="flex justify-between items-center">
        <Typography
          variant="caption"
          weight="bold"
          color={color === 'reflect' ? 'intel' : color}
          uppercase
          className="flex items-center gap-2"
        >
          {icon} {title}
        </Typography>
        <button
          type="button"
          onClick={onReset}
          className={`text-[9px] font-bold text-${color === 'reflect' ? 'intel' : color}/40 hover:text-${color === 'reflect' ? 'intel' : color} uppercase tracking-widest transition-colors flex items-center gap-1`}
        >
          {resetLabel}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{children}</div>
    </div>
  );
};

export function EvolutionEngineSection({
  t,
  evolutionMode,
  setEvolutionMode,
  deployLimit,
  setDeployLimit,
  optimizationPolicy,
  setOptimizationPolicy,
  maxToolIterations,
  setMaxToolIterations,
  THEME,
  ConfigTooltip: Tooltip,
  CyberSelect,
  CyberTooltip: CTooltip,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}: any) {
  return (
    <SettingSection
      title={t('SETTINGS_EVOLUTION_ENGINE_CONTROL')}
      icon={<Zap size={16} />}
      onReset={() => {}}
      resetLabel={t('SETTINGS_RESET_DEFAULTS')}
      color="primary"
    >
      <div className="space-y-2">
        <Typography
          variant="caption"
          weight="bold"
          color="white"
          uppercase
          className="flex items-center"
        >
          {t('SETTINGS_EVOLUTION_MODE')}
          <Tooltip id="evolution_mode" t={t} />
        </Typography>
        <CyberSelect
          name="evolutionMode"
          value={evolutionMode}
          onChange={setEvolutionMode}
          options={[
            { value: 'hitl', label: t('SETTINGS_HUMAN_IN_THE_LOOP') },
            { value: 'auto', label: t('SETTINGS_FULLY_AUTONOMOUS') },
          ]}
          className="w-full"
        />
      </div>
      <div className="space-y-2">
        <Typography
          variant="caption"
          weight="bold"
          color="white"
          uppercase
          className="flex items-center"
        >
          {t('SETTINGS_DAILY_DEPLOY_LIMIT')}
          <Tooltip id="deploy_limit" t={t} />
        </Typography>
        <input
          name="deployLimit"
          type="number"
          value={deployLimit}
          onChange={(e) => setDeployLimit(e.target.value)}
          className={`w-full bg-input border border-input rounded p-2 text-sm text-foreground outline-none focus:border-${THEME.COLORS.PRIMARY} transition-colors font-mono`}
        />
      </div>
      <div className="space-y-2">
        <Typography
          variant="caption"
          weight="bold"
          color="white"
          uppercase
          className="flex items-center"
        >
          {t('SETTINGS_OPTIMIZATION_POLICY')}
          <CTooltip
            content={
              <div className="space-y-2">
                <p>{t('SETTINGS_TOOLTIP_PRECEDENCE')}</p>
                <p>{t('SETTINGS_TOOLTIP_BALANCED')}</p>
                <p>{t('SETTINGS_TOOLTIP_AGGRESSIVE')}</p>
                <p>{t('SETTINGS_TOOLTIP_CONSERVATIVE')}</p>
              </div>
            }
          />
        </Typography>
        <CyberSelect
          name="optimizationPolicy"
          value={optimizationPolicy}
          onChange={setOptimizationPolicy}
          options={[
            { value: 'aggressive', label: t('SETTINGS_AGGRESSIVE') },
            { value: 'balanced', label: t('SETTINGS_BALANCED') },
            { value: 'conservative', label: t('SETTINGS_CONSERVATIVE') },
          ]}
          className="w-full"
        />
      </div>
      <div className="space-y-2">
        <Typography
          variant="caption"
          weight="bold"
          color="white"
          uppercase
          className="flex items-center"
        >
          {t('SETTINGS_MAX_TOOL_ITERATIONS')}
          <CTooltip
            content={
              <div className="space-y-2">
                <p>
                  <span className="text-cyber-blue font-bold">{t('SETTINGS_TOOLTIP_BENEFIT')}</span>{' '}
                  {t('SETTINGS_TOOLTIP_ITERATIONS_DESC')}
                </p>
                <p>
                  <span className="text-red-400 font-bold">{t('SETTINGS_TOOLTIP_COST')}</span>{' '}
                  {t('SETTINGS_TOOLTIP_ITERATIONS_COST')}
                </p>
              </div>
            }
          />
        </Typography>
        <input
          name="maxToolIterations"
          type="number"
          value={maxToolIterations}
          onChange={(e) => setMaxToolIterations(e.target.value)}
          className={`w-full bg-input border border-input rounded p-2 text-sm text-foreground outline-none focus:border-${THEME.COLORS.PRIMARY} transition-colors font-mono`}
        />
        <Typography variant="caption" color="muted" className="italic block mt-1">
          {t('SETTINGS_MAX_TOOL_ITERATIONS_DESC')}
        </Typography>
      </div>
    </SettingSection>
  );
}
