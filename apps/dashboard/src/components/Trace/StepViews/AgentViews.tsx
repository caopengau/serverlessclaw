import React from 'react';
import { HelpCircle, Pause, Play } from 'lucide-react';
import { ClarificationContent, AgentStateContent } from '@/lib/types/ui';

export const ClarificationView = ({ content }: { content: ClarificationContent }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <div className="text-[10px] text-purple-400 font-bold tracking-tighter flex items-center gap-1">
        <HelpCircle size={12} /> Clarification Question
      </div>
      <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded text-[11px] font-mono text-white/90 whitespace-pre-wrap leading-relaxed italic">
        &quot;{content.question || 'No question provided'}&quot;
      </div>
    </div>
    <div className="space-y-2">
      <div className="text-[10px] text-white/60 font-bold">Original Task</div>
      <div className="p-2 bg-white/[0.02] border border-white/10 rounded text-[10px] font-mono text-white/70">
        {content.originalTask || 'N/A'}
      </div>
    </div>
    <div className="flex gap-4">
      <div className="space-y-1">
        <div className="text-[9px] text-white/40 font-bold">Requesting Agent</div>
        <div className="text-[10px] text-purple-400 font-mono">{content.agentId || 'unknown'}</div>
      </div>
      <div className="space-y-1">
        <div className="text-[9px] text-white/40 font-bold">Retry Count</div>
        <div className="text-[10px] text-purple-400 font-mono">{content.retryCount ?? 0}</div>
      </div>
      <div className="space-y-1">
        <div className="text-[9px] text-white/40 font-bold">Depth</div>
        <div className="text-[10px] text-purple-400 font-mono">{content.depth ?? 0}</div>
      </div>
    </div>
  </div>
);

export const AgentStateView = ({ content, type }: { content: AgentStateContent; type: string }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <div className={`text-[10px] ${type.includes('waiting') ? 'text-yellow-400' : 'text-emerald-400'} font-bold tracking-tighter flex items-center gap-1`}>
        {type.includes('waiting') ? <Pause size={12} /> : <Play size={12} />}
        {type.includes('waiting') ? 'Agent Waiting' : 'Agent Resumed'}
      </div>
      <div className={`p-3 ${type.includes('waiting') ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-emerald-500/5 border-emerald-500/20'} border rounded text-[11px] font-mono text-white/90 whitespace-pre-wrap`}>
        {content.reason || (type.includes('waiting') ? 'Agent is waiting for external input' : 'Agent resumed execution')}
      </div>
    </div>
    <div className="space-y-1">
      <div className="text-[9px] text-white/40 font-bold">Agent</div>
      <div className={`text-[10px] ${type.includes('waiting') ? 'text-yellow-400' : 'text-emerald-400'} font-mono`}>
        {content.agentId || 'unknown'}
      </div>
    </div>
    {content.question && (
      <div className="space-y-2">
        <div className="text-[10px] text-white/60 font-bold">Waiting For</div>
        <div className="p-2 bg-white/[0.02] border border-white/10 rounded text-[10px] font-mono text-white/70 italic">
          &quot;{content.question}&quot;
        </div>
      </div>
    )}
  </div>
);
