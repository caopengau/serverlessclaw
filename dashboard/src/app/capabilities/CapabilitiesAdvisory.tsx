'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useTranslations } from '@/components/Providers/TranslationsProvider';

export default function CapabilitiesAdvisory() {
  const { t } = useTranslations();

  return (
    <div className="glass-card p-6 border-white/5 text-white/40 flex items-center gap-4">
      <AlertCircle size={20} className="text-[var(--cyber-blue)]/60 shrink-0" />
      <p className="text-[10px] uppercase tracking-widest leading-relaxed">
        {t('CAPABILITIES_ADVISORY')}
      </p>
    </div>
  );
}
