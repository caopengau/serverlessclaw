'use client';

import React from 'react';
import ResilienceGauge from './ResilienceGauge';
import { useTranslations } from '@/components/Providers/TranslationsProvider';

interface ResilienceGaugesSectionProps {
  isHealthy: boolean;
  logsLength: number;
  recoveryValue: number;
  recoveryStatus?: string;
}

export default function ResilienceGaugesSection({
  isHealthy,
  logsLength,
  recoveryValue,
  recoveryStatus,
}: ResilienceGaugesSectionProps) {
  const { t } = useTranslations();

  return (
    <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
      <div className="flex justify-center">
        <div className="relative">
          <ResilienceGauge
            value={isHealthy ? 95 : 40}
            label={t('RESILIENCE_SYSTEM_HEALTH')}
            subtitle={t('RESILIENCE_GAUGE_API_DB')}
          />
        </div>
      </div>
      <div className="flex justify-center">
        <div className="relative">
          <ResilienceGauge
            value={Math.min(100, logsLength * 10)}
            label={t('RESILIENCE_ERROR_DENSITY')}
            subtitle={t('RESILIENCE_GAUGE_FAILURE_SIGNALS')}
          />
        </div>
      </div>

      <div className="flex justify-center">
        <div className="relative">
          <ResilienceGauge
            value={recoveryValue}
            label={t('RESILIENCE_RECOVERY')}
            subtitle={
              recoveryStatus === 'unhealthy'
                ? t('RESILIENCE_CIRCUIT_BREAKER_TRIPPED')
                : t('RESILIENCE_DMS_TITLE')
            }
          />
        </div>
      </div>
    </div>
  );
}
