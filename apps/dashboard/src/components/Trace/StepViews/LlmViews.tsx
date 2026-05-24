/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { MessageSquare, Wrench, Code } from 'lucide-react';
import { LlmResponseContent } from '@/lib/types/ui';

export const LlmCallView = ({ content }: { content: any }) => {
  if (!content) {
    return <div className="text-xs text-muted-foreground italic">No content recorded.</div>;
  }

  // Handle simple string content
  if (typeof content === 'string') {
    return (
      <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded text-[11px] font-mono text-white/80 whitespace-pre-wrap">
        {content}
      </div>
    );
  }

  const hasMessages = Array.isArray(content.messages);
  const showMetaTable = content.model || content.provider || content.maxTokens || content.profile;

  return (
    <div className="space-y-3">
      {showMetaTable && (
        <div className="p-3 bg-white/[0.02] border border-white/5 rounded text-[11px] font-mono space-y-1.5">
          <div className="text-[10px] text-cyber-blue font-bold tracking-tighter flex items-center gap-1 mb-2">
            <Code size={12} /> Execution Context
          </div>
          {content.provider && (
            <div className="flex justify-between">
              <span className="text-white/40">Provider:</span>
              <span className="text-white/80 uppercase">{content.provider}</span>
            </div>
          )}
          {content.model && (
            <div className="flex justify-between">
              <span className="text-white/40">Model:</span>
              <span className="text-white/85 font-semibold text-cyber-blue">{content.model}</span>
            </div>
          )}
          {content.maxTokens && (
            <div className="flex justify-between">
              <span className="text-white/40">Max Tokens:</span>
              <span className="text-white/80">{content.maxTokens}</span>
            </div>
          )}
          {content.profile && (
            <div className="flex justify-between">
              <span className="text-white/40">Profile:</span>
              <span
                className="text-white/80 truncate max-w-[200px]"
                title={JSON.stringify(content.profile)}
              >
                {typeof content.profile === 'object'
                  ? JSON.stringify(content.profile)
                  : content.profile}
              </span>
            </div>
          )}
        </div>
      )}

      {hasMessages ? (
        <div className="space-y-2">
          <div className="text-[10px] text-cyber-blue font-bold tracking-tighter flex items-center gap-1">
            <Code size={12} /> Prompt messages
          </div>
          <div className="space-y-2">
            {content.messages.map((msg: any, idx: number) => (
              <div
                key={idx}
                className="p-2.5 bg-white/[0.02] border border-white/5 rounded text-[11px] font-mono"
              >
                <div className="text-cyber-blue/60 mb-1 text-[9px] font-bold">
                  [{msg.role || 'user'}]
                </div>
                <div className="text-white/80 whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : content.prompt ? (
        <div className="space-y-2">
          <div className="text-[10px] text-cyber-blue font-bold tracking-tighter flex items-center gap-1">
            <Code size={12} /> Prompt text
          </div>
          <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded text-[11px] font-mono text-white/80 whitespace-pre-wrap leading-relaxed">
            {content.prompt}
          </div>
        </div>
      ) : null}

      {!showMetaTable && !hasMessages && !content.prompt && (
        <div className="p-3 bg-white/[0.02] border border-white/5 rounded text-xs text-white/80 font-mono overflow-auto max-h-96">
          {JSON.stringify(content, null, 2)}
        </div>
      )}
    </div>
  );
};

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
