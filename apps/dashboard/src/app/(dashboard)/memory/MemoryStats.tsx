'use client';

import React from 'react';
import Typography from '@/components/ui/Typography';
import Badge from '@/components/ui/Badge';
import { useTranslations } from '@/components/Providers/TranslationsProvider';

interface MemoryStatsProps {
  factsCount: string | number;
  lessonsCount: string | number;
  dynamicCount: string | number;
}

export default function MemoryStats({ factsCount, lessonsCount, dynamicCount }: MemoryStatsProps) {
  const { t } = useTranslations();

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center text-center">
        <Typography
          variant="mono"
          color="muted"
          className="text-[10px] uppercase tracking-widest opacity-40 mb-1"
        >
          {t('MEMORY_TAB_FACTS')}
        </Typography>
        <Badge variant="primary" className="px-4 py-1 font-black text-xs">
          {factsCount}
        </Badge>
      </div>
      <div className="flex flex-col items-center text-center">
        <Typography
          variant="mono"
          color="muted"
          className="text-[10px] uppercase tracking-widest opacity-40 mb-1"
        >
          {t('MEMORY_TAB_LESSONS')}
        </Typography>
        <Badge variant="intel" className="px-4 py-1 font-black text-xs">
          {lessonsCount}
        </Badge>
      </div>
      <div className="flex flex-col items-center text-center">
        <Typography
          variant="mono"
          color="muted"
          className="text-[10px] uppercase tracking-widest opacity-40 mb-1"
        >
          {t('COMMON_TOTAL_NODES')}
        </Typography>
        <Badge
          variant="outline"
          className="px-4 py-1 font-black text-xs border-white/10 text-white/60"
        >
          {dynamicCount}
        </Badge>
      </div>
    </div>
  );
}
