import React from 'react';
import { Copy, Check, Wrench, ChevronDown, ChevronRight } from 'lucide-react';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';

export const CodeBlock = ({ children }: { children: string }) => {
  const [copied, setCopied] = React.useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code my-2">
      <div className="absolute right-2 top-2 z-10 opacity-0 group-hover/code:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          onClick={copyToClipboard}
          className="!p-1.5 h-auto bg-card-elevated border border-border text-muted-foreground hover:text-cyber-green"
          icon={copied ? <Check size={12} /> : <Copy size={12} />}
          title="Copy to clipboard"
        />
      </div>
      <pre className="bg-input p-3 rounded-md border border-border overflow-x-auto custom-scrollbar">
        <code className="font-mono text-sm text-cyber-green/90">{children}</code>
      </pre>
    </div>
  );
};

export interface ToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}

export const ToolCallsDisplay = ({ toolCalls }: { toolCalls: ToolCall[] }) => {
  const [expanded, setExpanded] = React.useState(false);

  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.03] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-amber-500/5 transition-colors"
      >
        {expanded ? (
          <ChevronDown size={12} className="text-amber-500/70" />
        ) : (
          <ChevronRight size={12} className="text-amber-500/70" />
        )}
        <Wrench size={12} className="text-amber-500/70" />
        <Typography
          variant="mono"
          className="text-[10px] text-amber-500/80 uppercase tracking-wider"
        >
          {toolCalls.length} tool call{toolCalls.length !== 1 ? 's' : ''}
        </Typography>
        <Typography variant="mono" className="text-[9px] text-muted-foreground/40 ml-auto">
          {toolCalls
            .map((tc) => tc.function?.name)
            .filter(Boolean)
            .join(', ')}
        </Typography>
      </button>
      {expanded && (
        <div className="border-t border-amber-500/10 px-3 py-2 space-y-2">
          {toolCalls.map((tc, i) => (
            <div key={tc.id || i} className="bg-input rounded p-2">
              <Typography variant="mono" className="text-[10px] text-amber-400 font-bold">
                {tc.function?.name ?? 'unknown'}
              </Typography>
              {tc.function?.arguments && (
                <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap overflow-x-auto custom-scrollbar">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(tc.function.arguments), null, 2);
                    } catch {
                      return tc.function.arguments;
                    }
                  })()}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
