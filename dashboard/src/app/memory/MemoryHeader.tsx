'use client';

import React from 'react';
import Typography from '@/components/ui/Typography';
import { useTranslations } from '@/components/Providers/TranslationsProvider';
import MemorySearch from './MemorySearch';

export default function MemoryHeader() {
  const { t } = useTranslations();

  return (
    <header className="flex flex-col lg:flex-row lg:justify-between lg:items-end border-b border-white/5 pb-6 gap-6">
      <div className="flex-1 min-w-0">
        <Typography variant="h2" color="white" glow uppercase>
          {t('MEMORY_NEURAL_RESERVE')}
        </Typography>
        <Typography variant="body" color="muted" className="mt-2 block lg:whitespace-nowrap">
          {t('MEMORY_VAULT_DESCRIPTION')}
        </Typography>
      </div>
      <MemorySearch />
    </header>
  );
}
