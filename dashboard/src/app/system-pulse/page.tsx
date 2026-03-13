'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Share2, Zap, Info } from 'lucide-react';
import { THEME } from '@/lib/theme';
import Badge from '@/components/ui/Badge';
import Typography from '@/components/ui/Typography';
import Card from '@/components/ui/Card';

// Dynamic import for React Flow component to avoid SSR issues
const Flow = dynamic(() => import('./Flow'), { 
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className={`text-${THEME.COLORS.INTEL} animate-pulse font-mono uppercase text-sm tracking-widest`}>
        Establishing Neural Uplink...
      </div>
    </div>
  )
});

export default function SystemPulsePage() {
  return (
    <main className={`flex-1 h-screen overflow-hidden flex flex-col p-6 lg:p-10 space-y-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-${THEME.COLORS.INTEL}/5 via-transparent to-transparent`}>
      <header className="flex justify-between items-end border-b border-white/5 pb-6">
        <div>
          <Typography variant="h2" color="white" glow uppercase>
            System Pulse
          </Typography>
          <Typography variant="body" color="muted" className="mt-2 block">
            Real-time infrastructure topology and neural routing visualization.
          </Typography>
        </div>
        <div className="flex gap-4">
            <div className="flex flex-col items-center">
                <Typography variant="mono" color="muted" className="text-[10px] uppercase tracking-widest opacity-40 mb-1">LATENCY</Typography>
                <Badge variant="primary" className="px-4 py-1 font-black text-xs bg-orange-500/10 text-orange-400 border-orange-500/20">42MS</Badge>
            </div>
            <div className="flex flex-col items-center text-center">
                <Typography variant="mono" color="muted" className="text-[10px] uppercase tracking-widest opacity-40 mb-1">STATUS</Typography>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-green-500/10 border border-green-500/20 rounded-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                    <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Live</span>
                </div>
            </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 glass-card border-white/5 overflow-hidden flex flex-col">
        <div className="px-6 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-[0.2em] text-white/70">
            <Zap size={14} className={`text-${THEME.COLORS.INTEL}`} /> Architecture Map
          </div>
          <div className="flex items-center gap-4 text-[9px] text-white/40">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-cyber-green"></div> AGENT_NODE
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div> PRIMARY_BUS
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-cyber-blue"></div> INFRA_NODE
            </div>
          </div>
        </div>
        <div className="flex-1 relative">
          <Flow />
        </div>
      </div>

      <footer className="grid grid-cols-3 gap-6 shrink-0 pt-4">
        <div className="glass-card p-4 flex gap-4 items-start border-white/5 bg-black/20">
          <div className="p-2 rounded bg-white/5">
            <Info size={16} className="text-white/50" />
          </div>
          <div>
            <Typography variant="mono" weight="bold" color="white" className="text-[10px] uppercase tracking-widest block">Topology_Scan</Typography>
            <p className="text-[10px] text-white/40 mt-1 leading-relaxed italic uppercase">
              Mapping autonomous agent dependencies and IAM-hardware boundaries.
            </p>
          </div>
        </div>
        <div className="col-span-2 glass-card p-4 flex items-center justify-between border-white/5 bg-black/20">
            <div className="flex gap-8">
                <div>
                    <Typography variant="mono" color="muted" className="text-[8px] uppercase tracking-[0.3em] block mb-1">Traffic_Load</Typography>
                    <Typography variant="mono" weight="bold" color="white" className="text-sm uppercase">Nominal</Typography>
                </div>
                <div>
                    <Typography variant="mono" color="muted" className="text-[8px] uppercase tracking-[0.3em] block mb-1">Trace_Density</Typography>
                    <Typography variant="mono" weight="bold" color="white" className="text-sm uppercase">High</Typography>
                </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-white/100 uppercase tracking-widest">
                <Share2 size={12} className={`text-${THEME.COLORS.INTEL}`} /> Stream_Online
            </div>
        </div>
      </footer>
    </main>
  );
}
