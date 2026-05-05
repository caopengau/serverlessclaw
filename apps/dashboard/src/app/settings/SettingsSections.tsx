import React from 'react';
import { Settings, RefreshCw, Zap } from 'lucide-react';
import Typography from '@/components/ui/Typography';
import CyberSelect from '@/components/CyberSelect';
import CyberTooltip from '@/components/CyberTooltip';
import { THEME } from '@/lib/theme';
import { EvolutionMode } from '@claw/core/lib/types/agent';
import {
  PROVIDERS,
  ConfigTooltip,
  SettingSection,
} from './SettingsParts';

interface BaseSectionProps {
  t: (key: string) => string;
}

interface LlmRoutingSectionProps extends BaseSectionProps {
  activeProvider: string;
  setActiveProvider: (val: string) => void;
  activeModel: string;
  setActiveModel: (val: string) => void;
  resetRouting: () => void;
}

export function LlmRoutingSection({
  t,
  activeProvider,
  setActiveProvider,
  activeModel,
  setActiveModel,
  resetRouting,
}: LlmRoutingSectionProps) {
  return (
    <SettingSection
      title={t('SETTINGS_LLM_PROVIDER_ROUTING')}
      icon={<Settings size={16} />}
      onReset={resetRouting}
      resetLabel={t('SETTINGS_RESET_DEFAULTS')}
      color="intel"
    >
      <div className="space-y-2">
        <Typography variant="caption" weight="bold" color="white" uppercase className="flex items-center">
          {t('SETTINGS_ACTIVE_PROVIDER')}
          <ConfigTooltip id="active_provider" t={t} />
        </Typography>
        <CyberSelect
          name="provider"
          value={activeProvider}
          onChange={(val) => {
            setActiveProvider(val);
            const provider = PROVIDERS[val as keyof typeof PROVIDERS];
            if (provider && provider.models.length > 0) {
              setActiveModel(provider.models[0]);
            }
          }}
          options={Object.entries(PROVIDERS).map(([id, p]) => ({
            value: id,
            label: p.label,
          }))}
          className="w-full"
        />
      </div>
      <div className="space-y-2">
        <Typography variant="caption" weight="bold" color="white" uppercase className="flex items-center">
          {t('SETTINGS_DEFAULT_MODEL_ID')}
          <ConfigTooltip id="active_model" t={t} />
        </Typography>
        <CyberSelect
          name="model"
          value={activeModel}
          onChange={setActiveModel}
          options={(PROVIDERS[activeProvider as keyof typeof PROVIDERS]?.models ?? []).map((m) => ({
            value: m,
            label: m,
          }))}
          className="w-full"
        />
      </div>
    </SettingSection>
  );
}

interface LanguageSectionProps extends BaseSectionProps {
  activeLocale: string;
  setActiveLocale: (val: string) => void;
  setLocale: (val: 'en' | 'cn') => void;
  resetLanguage: () => void;
}

export function LanguageSection({ t, activeLocale, setActiveLocale, setLocale, resetLanguage }: LanguageSectionProps) {
  return (
    <SettingSection
      title={t('LANGUAGE')}
      icon={<RefreshCw size={16} />}
      onReset={resetLanguage}
      resetLabel={t('SETTINGS_RESET_DEFAULTS')}
      color="intel"
    >
      <div className="space-y-2">
        <Typography variant="caption" weight="bold" color="white" uppercase className="flex items-center">
          {t('LANGUAGE')}
        </Typography>
        <CyberSelect
          name="activeLocale"
          value={activeLocale}
          onChange={(val) => {
            setActiveLocale(val);
            setLocale(val as 'en' | 'cn');
          }}
          options={[
            { value: 'en', label: t('ENGLISH') },
            { value: 'cn', label: t('CHINESE') },
          ]}
          className="w-full"
        />
      </div>
    </SettingSection>
  );
}

interface EvolutionEngineSectionProps extends BaseSectionProps {
  evolutionMode: string;
  setEvolutionMode: (val: string) => void;
  deployLimit: string | number;
  setDeployLimit: (val: string | number) => void;
  optimizationPolicy: string;
  setOptimizationPolicy: (val: string) => void;
  maxToolIterations: string | number;
  setMaxToolIterations: (val: string | number) => void;
  circuitBreakerThreshold: string | number;
  setCircuitBreakerThreshold: (val: string | number) => void;
  recursionLimit: string | number;
  setRecursionLimit: (val: string | number) => void;
  escalationEnabled: string;
  setEscalationEnabled: (val: string) => void;
  protocolFallbackEnabled: string;
  setProtocolFallbackEnabled: (val: string) => void;
  protectedResources: string;
  setProtectedResources: (val: string) => void;
  consecutiveBuildFailures: number;
  resetEvolution: () => void;
}

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
  circuitBreakerThreshold,
  setCircuitBreakerThreshold,
  recursionLimit,
  setRecursionLimit,
  escalationEnabled,
  setEscalationEnabled,
  protocolFallbackEnabled,
  setProtocolFallbackEnabled,
  protectedResources,
  setProtectedResources,
  consecutiveBuildFailures,
  resetEvolution,
}: EvolutionEngineSectionProps) {
  return (
    <SettingSection
      title={t('SETTINGS_EVOLUTION_ENGINE_CONTROL')}
      icon={<Zap size={16} />}
      onReset={resetEvolution}
      resetLabel={t('SETTINGS_RESET_DEFAULTS')}
      color="primary"
    >
      <div className="space-y-2">
        <Typography variant="caption" weight="bold" color="white" uppercase className="flex items-center">
          {t('SETTINGS_EVOLUTION_MODE')}
          <ConfigTooltip id="evolution_mode" t={t} />
        </Typography>
        <CyberSelect
          name="evolutionMode"
          value={evolutionMode}
          onChange={setEvolutionMode}
          options={[
            { value: EvolutionMode.HITL, label: t('SETTINGS_HUMAN_IN_THE_LOOP') },
            { value: EvolutionMode.AUTO, label: t('SETTINGS_FULLY_AUTONOMOUS') },
          ]}
          className="w-full"
        />
      </div>
      <div className="space-y-2">
        <Typography variant="caption" weight="bold" color="white" uppercase className="flex items-center">
          {t('SETTINGS_DAILY_DEPLOY_LIMIT')}
          <ConfigTooltip id="deploy_limit" t={t} />
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
        <Typography variant="caption" weight="bold" color="white" uppercase className="flex items-center">
          {t('SETTINGS_OPTIMIZATION_POLICY')}
          <CyberTooltip
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
        <Typography variant="caption" weight="bold" color="white" uppercase className="flex items-center">
          {t('SETTINGS_MAX_TOOL_ITERATIONS')}
          <CyberTooltip
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
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Typography variant="caption" weight="bold" color="white" uppercase className="flex items-center">
            {t('SETTINGS_CIRCUIT_BREAKER_THRESHOLD')}
            <ConfigTooltip id="circuit_breaker_threshold" t={t} />
          </Typography>
          <Typography variant="mono" weight="bold" color={Number(consecutiveBuildFailures) > 0 ? 'danger' : 'primary'} className="text-[10px]">
            {t('SETTINGS_FAILURES').replace('{count}', String(consecutiveBuildFailures))}
          </Typography>
        </div>
        <input
          name="circuitBreakerThreshold"
          type="number"
          value={circuitBreakerThreshold}
          onChange={(e) => setCircuitBreakerThreshold(e.target.value)}
          className={`w-full bg-input border border-input rounded p-2 text-sm text-foreground outline-none focus:border-${THEME.COLORS.PRIMARY} transition-colors font-mono`}
        />
      </div>
      <div className="space-y-2">
        <Typography variant="caption" weight="bold" color="white" uppercase className="flex items-center">
          {t('SETTINGS_RECURSION_LIMIT')}
          <ConfigTooltip id="recursion_limit" t={t} />
        </Typography>
        <input
          name="recursionLimit"
          type="number"
          value={recursionLimit}
          onChange={(e) => setRecursionLimit(e.target.value)}
          className={`w-full bg-input border border-input rounded p-2 text-sm text-foreground outline-none focus:border-${THEME.COLORS.PRIMARY} transition-colors font-mono`}
        />
      </div>
      <div className="space-y-2">
        <Typography variant="caption" weight="bold" color="white" uppercase className="flex items-center">
          {t('SETTINGS_ESCALATION_ENGINE')}
          <ConfigTooltip id="escalation_enabled" t={t} />
        </Typography>
        <CyberSelect
          name="escalationEnabled"
          value={escalationEnabled}
          onChange={setEscalationEnabled}
          options={[
            { value: 'true', label: t('SETTINGS_ENABLED_MULTI_CHANNEL') },
            { value: 'false', label: t('SETTINGS_DISABLED_LEGACY') },
          ]}
          className="w-full"
        />
      </div>
      <div className="space-y-2">
        <Typography variant="caption" weight="bold" color="white" uppercase className="flex items-center">
          {t('SETTINGS_PROTOCOL_FALLBACK')}
          <ConfigTooltip id="protocol_fallback_enabled" t={t} />
        </Typography>
        <CyberSelect
          name="protocolFallbackEnabled"
          value={protocolFallbackEnabled}
          onChange={setProtocolFallbackEnabled}
          options={[
            { value: 'true', label: t('SETTINGS_ENABLED_JSON_TEXT') },
            { value: 'false', label: t('SETTINGS_DISABLED_FAIL_JSON') },
          ]}
          className="w-full"
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Typography variant="caption" weight="bold" color="white" uppercase className="flex items-center">
          {t('SETTINGS_PROTECTED_RESOURCE_SCOPES')}
          <ConfigTooltip id="protected_resources" t={t} />
        </Typography>
        <input
          name="protectedResources"
          type="text"
          value={protectedResources}
          onChange={(e) => setProtectedResources(e.target.value)}
          className={`w-full bg-input border border-input rounded p-2 text-sm text-foreground outline-none focus:border-${THEME.COLORS.PRIMARY} transition-colors font-mono`}
        />
      </div>
    </SettingSection>
  );
}

interface ReflectionConfigSectionProps extends BaseSectionProps {
  reflectionFrequency: string | number;
  setReflectionFrequency: (val: string | number) => void;
  strategicReviewFrequency: string | number;
  setStrategicReviewFrequency: (val: string | number) => void;
  minGapsForReview: string | number;
  setMinGapsForReview: (val: string | number) => void;
  resetReflection: () => void;
}

export function ReflectionConfigSection({
  t,
  reflectionFrequency,
  setReflectionFrequency,
  strategicReviewFrequency,
  setStrategicReviewFrequency,
  minGapsForReview,
  setMinGapsForReview,
  resetReflection,
}: ReflectionConfigSectionProps) {
  return (
    <SettingSection
      title={t('SETTINGS_NEURAL_REFLECTION_CONFIG')}
      icon={<RefreshCw size={16} />}
      onReset={resetReflection}
      resetLabel={t('SETTINGS_RESET_DEFAULTS')}
      color="reflect"
    >
      <div className="space-y-2">
        <Typography variant="caption" weight="bold" color="white" uppercase className="flex items-center">
          {t('SETTINGS_REFLECTION_FREQUENCY')}
          <ConfigTooltip id="reflection_frequency" t={t} />
        </Typography>
        <input
          name="reflectionFrequency"
          type="number"
          value={reflectionFrequency}
          onChange={(e) => setReflectionFrequency(e.target.value)}
          className={`w-full bg-input border border-input rounded p-2 text-sm text-foreground outline-none focus:border-${THEME.COLORS.REFLECT} transition-colors font-mono`}
        />
      </div>
      <div className="space-y-2">
        <Typography variant="caption" weight="bold" color="white" uppercase className="flex items-center">
          {t('SETTINGS_STRATEGIC_REVIEW_INTERVAL')}
          <ConfigTooltip id="strategic_review_frequency" t={t} />
        </Typography>
        <input
          name="strategicReviewFrequency"
          type="number"
          value={strategicReviewFrequency}
          onChange={(e) => setStrategicReviewFrequency(e.target.value)}
          className={`w-full bg-input border border-input rounded p-2 text-sm text-foreground outline-none focus:border-${THEME.COLORS.REFLECT} transition-colors font-mono`}
        />
      </div>
      <div className="space-y-2">
        <Typography variant="caption" weight="bold" color="white" uppercase className="flex items-center">
          {t('SETTINGS_MIN_GAPS_FOR_REVIEW')}
          <ConfigTooltip id="min_gaps_for_review" t={t} />
        </Typography>
        <input
          name="minGapsForReview"
          type="number"
          value={minGapsForReview}
          onChange={(e) => setMinGapsForReview(e.target.value)}
          className={`w-full bg-input border border-input rounded p-2 text-sm text-foreground outline-none focus:border-${THEME.COLORS.REFLECT} transition-colors font-mono`}
        />
      </div>
    </SettingSection>
  );
}
