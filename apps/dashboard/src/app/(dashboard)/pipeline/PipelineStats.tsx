'use client';

import React from 'react';
import Typography from '@/components/ui/Typography';
import Badge from '@/components/ui/Badge';
import { useTranslations } from '@/components/Providers/TranslationsProvider';
import { GapStatus } from '@claw/core/lib/types';
import { GapItem } from '@claw/core/lib/types/memory';

export default function PipelineStats({ gaps }: { gaps: GapItem[] }) {
  const { t } = useTranslations();

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center text-center">
        <Typography
          variant="mono"
          color="muted"
          className="text-[10px] uppercase tracking-widest opacity-40 mb-1"
        >
          {t('PIPELINE_ACTIVE')}
        </Typography>
        <Badge variant="primary" className="px-4 py-1 font-black text-xs">
          {gaps.filter((g) => g.status !== GapStatus.DONE).length}
        </Badge>
      </div>
      <div className="flex flex-col items-center text-center">
        <Typography
          variant="mono"
          color="muted"
          className="text-[10px] uppercase tracking-widest opacity-40 mb-1"
        >
          {t('PIPELINE_SUCCESS')}
        </Typography>
        <Badge variant="intel" className="px-4 py-1 font-black text-xs">
          {gaps.filter((g) => g.status === GapStatus.DONE).length}
        </Badge>
      </div>
    </div>
  );
}
