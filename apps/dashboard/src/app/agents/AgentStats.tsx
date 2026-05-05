import React from 'react';
import Typography from '@/components/ui/Typography';
import Badge from '@/components/ui/Badge';
import { Agent } from '@/lib/types/ui';

interface AgentStatsProps {
  agents: Agent[];
  t: (key: string) => string;
}

export const AgentStats: React.FC<AgentStatsProps> = ({ agents, t }) => {
  const activeCount = agents.filter((a) => a.enabled).length;
  const backboneCount = agents.filter((a) => a.isBackbone).length;

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center text-center">
        <Typography
          variant="mono"
          color="muted"
          className="text-[10px] uppercase tracking-widest opacity-40 mb-1"
        >
          {t('AGENTS_TOTAL')}
        </Typography>
        <Badge variant="primary" className="px-4 py-1 font-black text-xs">
          {agents.length}
        </Badge>
      </div>
      <div className="flex flex-col items-center text-center">
        <Typography
          variant="mono"
          color="muted"
          className="text-[10px] uppercase tracking-widest opacity-40 mb-1"
        >
          {t('AGENTS_ACTIVE')}
        </Typography>
        <Badge variant="intel" className="px-4 py-1 font-black text-xs">
          {activeCount}
        </Badge>
      </div>
      <div className="flex flex-col items-center text-center">
        <Typography
          variant="mono"
          color="muted"
          className="text-[10px] uppercase tracking-widest opacity-40 mb-1"
        >
          {t('AGENTS_BACKBONE')}
        </Typography>
        <Badge variant="audit" className="px-4 py-1 font-black text-xs">
          {backboneCount}
        </Badge>
      </div>
    </div>
  );
};
