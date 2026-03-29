'use client';

import React from 'react';
import Typography from '@/components/ui/Typography';
import { DollarSign, TrendingUp, AlertTriangle, PieChart } from 'lucide-react';

interface TrackBudget {
  track: string;
  allocated: number;
  spent: number;
}

export default function EvolutionBudgetView({ budgets }: { budgets: TrackBudget[] }) {
  const totalAllocated = budgets.reduce((acc, b) => acc + b.allocated, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + b.spent, 0);
  const totalPercent = (totalSpent / totalAllocated) * 100;

  return (
    <div className="space-y-8">
      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-cyber-blue/10 rounded-full blur-2xl group-hover:bg-cyber-blue/20 transition-all" />
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-cyber-blue/10 rounded-xl text-cyber-blue">
              <DollarSign size={20} />
            </div>
            <Typography variant="mono" className="text-xs uppercase tracking-widest text-white/40 font-bold">TOTAL_ALLOCATED</Typography>
          </div>
          <Typography variant="h2" glow>${totalAllocated.toFixed(2)}</Typography>
        </div>

        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-cyber-green/10 rounded-full blur-2xl group-hover:bg-cyber-green/20 transition-all" />
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-cyber-green/10 rounded-xl text-cyber-green">
              <TrendingUp size={20} />
            </div>
            <Typography variant="mono" className="text-xs uppercase tracking-widest text-white/40 font-bold">TOTAL_SPENT</Typography>
          </div>
          <Typography variant="h2" className="text-cyber-green" glow>${totalSpent.toFixed(2)}</Typography>
        </div>

        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
              <PieChart size={20} />
            </div>
            <Typography variant="mono" className="text-xs uppercase tracking-widest text-white/40 font-bold">BUDGET_UTILIZATION</Typography>
          </div>
          <Typography variant="h2" className="text-amber-500" glow>{totalPercent.toFixed(1)}%</Typography>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white/5 border border-white/10 p-1 rounded-full overflow-hidden h-4">
        <div 
          className="h-full bg-gradient-to-r from-cyber-blue via-cyber-green to-amber-500 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(0,243,255,0.5)]"
          style={{ width: `${Math.min(totalPercent, 100)}%` }}
        />
      </div>

      {/* Track Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {budgets.map((b) => {
          const percent = (b.spent / b.allocated) * 100;
          return (
            <div key={b.track} className="bg-white/[0.02] border border-white/5 p-5 rounded-xl flex items-center justify-between group hover:bg-white/[0.05] transition-all">
              <div className="space-y-1">
                <Typography variant="mono" className="text-xs uppercase font-black text-white/60 group-hover:text-cyber-blue transition-colors">
                  TRACK: {b.track}
                </Typography>
                <div className="flex gap-4">
                  <Typography variant="mono" className="text-[10px] opacity-40">
                    USED: ${b.spent.toFixed(2)}
                  </Typography>
                  <Typography variant="mono" className="text-[10px] opacity-40">
                    CAP: ${b.allocated.toFixed(2)}
                  </Typography>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <Typography variant="mono" className={`text-sm font-bold ${percent > 80 ? 'text-red-500' : 'text-white/80'}`}>
                    {percent.toFixed(0)}%
                  </Typography>
                </div>
                {percent > 90 && <AlertTriangle size={16} className="text-red-500 animate-pulse" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
