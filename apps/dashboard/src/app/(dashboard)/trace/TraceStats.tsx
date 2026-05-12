'use client';

import React from 'react';
import Typography from '@/components/ui/Typography';
import Badge from '@/components/ui/Badge';
import { useTranslations } from '@/components/Providers/TranslationsProvider';

interface TraceStatsProps {
  provider: string;
  model: string;
  totalOps: number;
}

export default function TraceStats({ provider, model, totalOps }: TraceStatsProps) {
  const { t } = useTranslations();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:flex gap-3 lg:gap-4">
      <div className="flex flex-col items-center">
        <Typography
          variant="mono"
          color="muted"
          className="text-[10px] uppercase tracking-widest opacity-40 mb-1"
        >
          {t('COMMON_PROVIDER')}
        </Typography>
        <Badge
          variant="outline"
          className="px-4 py-1 font-bold text-xs border-cyber-blue/20 text-cyber-blue/60 uppercase"
        >
          {provider}
        </Badge>
      </div>
      <div className="flex flex-col items-center">
        <Typography
          variant="mono"
          color="muted"
          className="text-[10px] uppercase tracking-widest opacity-40 mb-1"
        >
          {t('COMMON_MODEL')}
        </Typography>
        <Badge
          variant="outline"
          className="px-4 py-1 font-bold text-xs border-white/10 text-white/60 uppercase"
        >
          {model}
        </Badge>
      </div>
      <div className="flex flex-col items-center">
        <Typography
          variant="mono"
          color="muted"
          className="text-[10px] uppercase tracking-widest opacity-40 mb-1"
        >
          {t('COMMON_TOTAL_OPS')}
        </Typography>
        <Badge variant="primary" className="px-4 py-1 font-black text-xs">
          {totalOps}
        </Badge>
      </div>
    </div>
  );
}
