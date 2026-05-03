'use client';

import React from 'react';

export default function GridStatus({ component }: any) {
  const { data } = component;
  
  return (
    <div className="p-4 border border-cyber-green/30 bg-cyber-green/5 rounded-lg font-mono">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-cyber-green text-xs font-bold uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 bg-cyber-green rounded-full animate-pulse" />
          Live Power Grid Status
        </h3>
        <span className="text-[10px] text-foreground/40">NODE: {data?.nodeId || 'GLOBAL'}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-[8px] text-foreground/50 uppercase">Current Load</div>
          <div className="text-xl text-foreground font-black">{data?.load || '12.4'} MW</div>
        </div>
        <div className="space-y-1">
          <div className="text-[8px] text-foreground/50 uppercase">Frequency</div>
          <div className="text-xl text-foreground font-black">{data?.frequency || '50.02'} Hz</div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-cyber-green/10">
        <div className="flex justify-between items-end">
          <div>
            <div className="text-[8px] text-foreground/50 uppercase">Arbitrage Delta</div>
            <div className="text-sm text-cyber-green font-bold">+$1,240.50</div>
          </div>
          <div className="text-[8px] text-foreground/30 italic">VOLTX AGENT v1.0</div>
        </div>
      </div>
    </div>
  );
}
