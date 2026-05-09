import React from 'react';
import { Terminal, CheckCircle, ShieldAlert } from 'lucide-react';
import { ToolCallContent, ToolResultContent, ErrorContent } from '@/lib/types/ui';

export const ToolCallView = ({ content }: { content: ToolCallContent }) => (
  <div className="space-y-2">
    <div className="text-[10px] text-yellow-500 font-bold tracking-tighter flex items-center gap-1">
      <Terminal size={12} /> Tool input (JSON)
    </div>
    <div className="p-3 bg-black/60 border border-yellow-500/20 rounded text-[11px] font-mono text-yellow-500/90 whitespace-pre-wrap shadow-inner">
      {JSON.stringify(content.args, null, 2)}
    </div>
  </div>
);

export const ToolResultView = ({ content }: { content: ToolResultContent }) => (
  <div className="space-y-2">
    <div className="text-[10px] text-cyber-green font-bold tracking-tighter flex items-center gap-1">
      <CheckCircle size={12} /> Tool output
    </div>
    <div className="p-3 bg-black/60 border border-cyber-green/20 rounded text-[11px] font-mono text-white/90 whitespace-pre-wrap shadow-inner overflow-x-auto">
      {typeof content.result === 'string'
        ? content.result
        : JSON.stringify(content.result, null, 2)}
    </div>
  </div>
);

export const ErrorView = ({ content }: { content: ErrorContent }) => (
  <div className="space-y-2">
    <div className="text-[10px] text-red-500 font-bold tracking-tighter flex items-center gap-1">
      <ShieldAlert size={12} /> Error details
    </div>
    <div className="p-3 bg-red-500/5 border border-red-500/20 rounded text-[11px] font-mono text-red-400 whitespace-pre-wrap shadow-inner">
      {content.errorMessage}
    </div>
  </div>
);
