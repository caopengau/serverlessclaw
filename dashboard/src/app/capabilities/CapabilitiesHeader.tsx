'use client';

import React from 'react';
import Typography from '@/components/ui/Typography';
import Badge from '@/components/ui/Badge';
import { useTranslations } from '@/components/Providers/TranslationsProvider';

interface CapabilitiesHeaderProps {
  localCount: number;
  bridgeCount: number;
}

export default function CapabilitiesHeader({ localCount, bridgeCount }: CapabilitiesHeaderProps) {
  const { t } = useTranslations();

  return (
    <header className="flex justify-between items-end border-b border-white/5 pb-6">
      <div>
        <Typography variant="h2" color="white" glow uppercase>
          {t('CAPABILITIES_TOOLS_SKILLS')}
        </Typography>
        <Typography variant="body" color="muted" className="mt-2 block">
          {t('CAPABILITIES_DESCRIPTION')}
        </Typography>
      </div>
      <div className="flex gap-4">
        <div className="flex flex-col items-center text-center">
          <Typography
            variant="mono"
            color="muted"
            className="text-[10px] uppercase tracking-widest opacity-40 mb-1"
          >
            {t('CAPABILITIES_LOCAL')}
          </Typography>
          <Badge
            variant="outline"
            className="px-4 py-1 font-bold text-xs border-yellow-500/20 text-yellow-500/60 uppercase"
          >
            {localCount}
          </Badge>
        </div>
        <div className="flex flex-col items-center text-center">
          <Typography
            variant="mono"
            color="muted"
            className="text-[10px] uppercase tracking-widest opacity-40 mb-1"
          >
            {t('CAPABILITIES_BRIDGES')}
          </Typography>
          <Badge
            variant="outline"
            className="px-4 py-1 font-bold text-xs border-cyber-blue/20 text-cyber-blue/60 uppercase"
          >
            {bridgeCount}
          </Badge>
        </div>
      </div>
    </header>
  );
}
