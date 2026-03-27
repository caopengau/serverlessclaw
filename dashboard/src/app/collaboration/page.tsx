'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Activity, Bot, GitBranch, Zap } from 'lucide-react';
import Typography from '@/components/ui/Typography';
import { THEME } from '@/lib/theme';

// Dynamic import for Collaboration Canvas component
const CollaborationCanvas = dynamic(() => import('./CollaborationCanvas'), { 
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className={`text-${THEME.COLORS.INTEL} animate-pulse font-mono uppercase text-sm tracking-widest`}>
        Initializing Collaboration Matrix...
      </div>
    </div>
  )
});

export default function CollaborationPage() {
  return (
    <main className={`flex-1 h-screen overflow-hidden flex flex-col p-6 lg:p-10 space-y-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-purple-500/5 via-transparent to-transparent`}>
      <header className="flex justify-between items-end border-b border-white/5 pb-6">
        <div>
          <Typography variant="h2" color="white" glow uppercase>
            Collaboration Canvas
          </Typography>
          <Typography variant="body" color="muted" className="mt-2 block">
            Real-time visibility into multi-agent task execution and DAG workflows.
          </Typography>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.2em] text-white/70">
            <Activity size={14} className={`text-${THEME.COLORS.PRIMARY}`} /> Live Agent Feed
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 glass-card border-white/5 overflow-hidden flex flex-col">
        <div className="px-6 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.2em] text-white/70">
            <GitBranch size={14} className="text-purple-400" /> Multi-Agent Task Matrix
          </div>
          <div className="flex items-center gap-4 text-[9px] text-white/40">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse"></div> RUNNING
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div> PENDING
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-cyber-blue"></div> COMPLETED
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500"></div> FAILED
            </div>
          </div>
        </div>
        <div className="flex-1 relative">
          <CollaborationCanvas />
        </div>
      </div>
    </main>
  );
}