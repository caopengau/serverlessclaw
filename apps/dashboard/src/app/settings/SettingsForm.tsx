'use client';

import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { useTranslations } from '@/components/Providers/TranslationsProvider';
import { SYSTEM } from '@claw/core/lib/constants';
import { LLMProvider, OpenAIModel } from '@claw/core/lib/types/llm';
import { EvolutionMode } from '@claw/core/lib/types/agent';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { type SystemConfig } from './SettingsParts';
import {
  LlmRoutingSection,
  LanguageSection,
  EvolutionEngineSection,
  ReflectionConfigSection,
} from './SettingsSections';

interface SettingsFormProps {
  config: SystemConfig;
  updateConfig: (formData: FormData) => Promise<void>;
}

export default function SettingsForm({ config, updateConfig }: SettingsFormProps) {
  const [activeProvider, setActiveProvider] = useState(config.provider);
  const [activeModel, setActiveModel] = useState(config.model);
  const [evolutionMode, setEvolutionMode] = useState(config.evolutionMode);
  const [optimizationPolicy, setOptimizationPolicy] = useState(config.optimizationPolicy);
  const [activeLocale, setActiveLocale] = useState(config.activeLocale);
  const [maxToolIterations, setMaxToolIterations] = useState(config.maxToolIterations);
  const [circuitBreakerThreshold, setCircuitBreakerThreshold] = useState(
    config.circuitBreakerThreshold
  );
  const [protectedResources, setProtectedResources] = useState(config.protectedResources);
  const [reflectionFrequency, setReflectionFrequency] = useState(config.reflectionFrequency);
  const [strategicReviewFrequency, setStrategicReviewFrequency] = useState(
    config.strategicReviewFrequency
  );
  const [minGapsForReview, setMinGapsForReview] = useState(config.minGapsForReview);
  const [recursionLimit, setRecursionLimit] = useState(config.recursionLimit);
  const [deployLimit, setDeployLimit] = useState(config.deployLimit);
  const [escalationEnabled, setEscalationEnabled] = useState(config.escalationEnabled);
  const [protocolFallbackEnabled, setProtocolFallbackEnabled] = useState(
    config.protocolFallbackEnabled
  );

  const { t, setLocale } = useTranslations();

  const resetRouting = () => {
    setActiveProvider(LLMProvider.OPENAI);
    setActiveModel(OpenAIModel.GPT_5_4);
  };

  const resetLanguage = () => {
    setActiveLocale('en');
    setLocale('en');
  };

  const resetEvolution = () => {
    setEvolutionMode(EvolutionMode.HITL);
    setDeployLimit('5');
    setOptimizationPolicy('balanced');
    setMaxToolIterations('15');
    setCircuitBreakerThreshold('5');
    setRecursionLimit('50');
    setEscalationEnabled('true');
    setProtocolFallbackEnabled('true');
    setProtectedResources('sst.config.ts, buildspec.yml, infra/');
  };

  const resetReflection = () => {
    setReflectionFrequency('10');
    setStrategicReviewFrequency('24');
    setMinGapsForReview('10');
  };

  return (
    <>
      <form id="settings-form" action={updateConfig} className="space-y-10">
        <Card variant="glass" padding="lg" className="space-y-8 cyber-border relative">
          <LlmRoutingSection
            t={t}
            activeProvider={activeProvider}
            setActiveProvider={setActiveProvider}
            activeModel={activeModel}
            setActiveModel={setActiveModel}
            resetRouting={resetRouting}
          />

          <LanguageSection
            t={t}
            activeLocale={activeLocale}
            setActiveLocale={setActiveLocale}
            setLocale={setLocale}
            resetLanguage={resetLanguage}
          />

          <EvolutionEngineSection
            t={t}
            evolutionMode={evolutionMode}
            setEvolutionMode={setEvolutionMode}
            deployLimit={deployLimit}
            setDeployLimit={setDeployLimit}
            optimizationPolicy={optimizationPolicy}
            setOptimizationPolicy={setOptimizationPolicy}
            maxToolIterations={maxToolIterations}
            setMaxToolIterations={setMaxToolIterations}
            circuitBreakerThreshold={circuitBreakerThreshold}
            setCircuitBreakerThreshold={setCircuitBreakerThreshold}
            recursionLimit={recursionLimit}
            setRecursionLimit={setRecursionLimit}
            escalationEnabled={escalationEnabled}
            setEscalationEnabled={setEscalationEnabled}
            protocolFallbackEnabled={protocolFallbackEnabled}
            setProtocolFallbackEnabled={setProtocolFallbackEnabled}
            protectedResources={protectedResources}
            setProtectedResources={setProtectedResources}
            consecutiveBuildFailures={config.consecutiveBuildFailures}
            resetEvolution={resetEvolution}
          />

          <ReflectionConfigSection
            t={t}
            reflectionFrequency={reflectionFrequency}
            setReflectionFrequency={setReflectionFrequency}
            strategicReviewFrequency={strategicReviewFrequency}
            setStrategicReviewFrequency={setStrategicReviewFrequency}
            minGapsForReview={minGapsForReview}
            setMinGapsForReview={setMinGapsForReview}
            resetReflection={resetReflection}
          />
        </Card>
      </form>

      <div className="fixed bottom-10 right-10 z-30">
        <Button
          type="submit"
          form="settings-form"
          variant="primary"
          size="lg"
          icon={<Save size={16} />}
          uppercase
          className="shadow-[0_0_20px_rgba(0,0,0,0.5)] scale-105 active:scale-95"
        >
          {t('SAVE')}
        </Button>
      </div>
    </>
  );
}
