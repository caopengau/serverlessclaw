'use client';

import React from 'react';
import Typography from '@/components/ui/Typography';
import { EvolutionTrack, GapStatus } from '@claw/core/lib/types/agent';
import { KanbanSquare, Zap, Shield, Performance, Layout, Hammer } from 'lucide-react';

interface Gap {
  id: string;
  title: string;
  status: GapStatus;
  track: EvolutionTrack;
  priority: number;
}

const TRACK_ICONS = {
  [EvolutionTrack.SECURITY]: <Shield size={14} />,
  [EvolutionTrack.PERFORMANCE]: <Zap size={14} />,
  [EvolutionTrack.FEATURE]: <Layout size={14} />,
  [EvolutionTrack.INFRASTRUCTURE]: <Hammer size={14} />,
  [EvolutionTrack.REFACTORING]: <KanbanSquare size={14} />,
};

const COLUMNS = [
  { status: GapStatus.OPEN, label: 'Backlog' },
  { status: GapStatus.PLANNED, label: 'Planned' },
  { status: GapStatus.PROGRESS, label: 'In Progress' },
  { status: GapStatus.DEPLOYED, label: 'Deployed' },
  { status: GapStatus.DONE, label: 'Completed' },
];

export default function EvolutionKanban({ gaps }: { gaps: Gap[] }) {
  return (
    <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide">
      {COLUMNS.map((column) => (
        <div key={column.status} className="flex-shrink-0 w-80 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Typography variant="mono" className="text-xs font-black uppercase tracking-widest text-white/40">
                {column.label}
              </Typography>
              <div className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] font-bold text-white/60">
                {gaps.filter(g => g.status === column.status).length}
              </div>
            </div>
          </div>

          <div className="space-y-3 min-h-[500px] bg-white/[0.02] border border-white/5 rounded-2xl p-3">
            {gaps
              .filter((g) => g.status === column.status)
              .sort((a, b) => a.priority - b.priority)
              .map((gap) => (
                <div 
                  key={gap.id}
                  className="bg-[#0A0A0B] border border-white/10 p-4 rounded-xl hover:border-cyber-blue/30 transition-all cursor-pointer group shadow-lg"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-white/5 rounded text-white/40 group-hover:text-cyber-blue transition-colors">
                      {TRACK_ICONS[gap.track]}
                    </div>
                    <Typography variant="mono" className="text-[9px] uppercase tracking-tighter opacity-40">
                      {gap.track}
                    </Typography>
                  </div>

                  <Typography variant="body" className="text-sm font-medium line-clamp-2 leading-snug text-white/90">
                    {gap.title}
                  </Typography>

                  <div className="mt-4 flex items-center justify-between">
                    <Typography variant="mono" className="text-[10px] opacity-20 truncate w-24">
                      {gap.id}
                    </Typography>
                    <div className={`
                      text-[9px] font-black px-2 py-0.5 rounded
                      ${gap.priority <= 3 ? 'bg-red-500/10 text-red-500' : 
                        gap.priority <= 6 ? 'bg-amber-500/10 text-amber-500' : 
                        'bg-cyber-blue/10 text-cyber-blue'}
                    `}>
                      P{gap.priority}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
