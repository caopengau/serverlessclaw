'use client';

import React from 'react';
import Typography from '@/components/ui/Typography';
import { useTranslations } from '@/components/Providers/TranslationsProvider';

export default function SettingsHeader() {
  const { t } = useTranslations();

  return (
    <header className="flex flex-col lg:flex-row lg:justify-between lg:items-end border-b border-white/5 pb-6 gap-6">
      <div>
        <Typography variant="h2" color="white" glow uppercase>
          {t('SETTINGS_SYSTEM_CONFIGURATION')}
        </Typography>
        <Typography variant="body" color="muted" className="mt-2 block">
          {t('SETTINGS_SYSTEM_DESCRIPTION')}
        </Typography>
      </div>
    </header>
  );
}
