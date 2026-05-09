import React from 'react';
import { MessageSquare, Wrench, Code } from 'lucide-react';
import { LlmCallContent, LlmResponseContent } from '@/lib/types/ui';

export const LlmCallView = ({ content }: { content: LlmCallContent }) => (
  <div className="space-y-2">
    <div className="text-[10px] text-cyber-blue font-bold tracking-tighter flex items-center gap-1">
      <Code size={12} /> Prompt context
    </div>
    <div className="space-y-2">
      {content.messages.map((msg, idx) => (
        <div
          key={idx}
          className="p-2 bg-white/[0.02] border border-white/5 rounded text-[11px] font-mono"
        >
          <div className="text-cyber-blue/60 mb-1 text-[9px] font-bold">[{msg.role}]</div>
          <div className="text-white/80 whitespace-pre-wrap leading-relaxed">{msg.content}</div>
        </div>
      ))}
    </div>
  </div>
);

export const LlmResponseView = ({ content }: { content: LlmResponseContent }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <div className="text-[10px] text-cyber-green font-bold tracking-tighter flex items-center gap-1">
        <MessageSquare size={12} /> LLM content
      </div>
      <div className="p-2 bg-white/[0.02] border border-white/5 rounded text-[11px] font-mono text-white/80 whitespace-pre-wrap leading-relaxed">
        {(() => {
          const text = content.content || content.response;
          if (!text) return 'No text content provided.';
          try {
            return JSON.stringify(JSON.parse(text), null, 2);
          } catch {
            return text;
          }
        })()}
      </div>
    </div>
    {content.tool_calls && content.tool_calls.length > 0 && (
      <div className="space-y-2">
        <div className="text-[10px] text-yellow-500 font-bold tracking-tighter flex items-center gap-1">
          <Wrench size={12} /> Delegated tools
        </div>
        {content.tool_calls.map((tc, idx) => (
          <div
            key={idx}
            className="p-2 bg-yellow-500/5 border border-yellow-500/20 rounded text-[10px] font-mono"
          >
            <div className="text-yellow-500/80 mb-1 font-bold">{tc.function.name}</div>
            <div className="text-white/60 truncate">{tc.function.arguments}</div>
          </div>
        ))}
      </div>
    )}
  </div>
);
