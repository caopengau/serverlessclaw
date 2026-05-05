import React from 'react';
import { Layers, Shield, GitBranch, Cpu, ShieldAlert, Brain } from 'lucide-react';
import {
  ParallelDispatchContent,
  ParallelBarrierContent,
  CouncilReviewContent,
  ContinuationContent,
  CircuitBreakerContent,
  CancellationContent,
  MemoryOperationContent,
  ReflectContent,
  ResultContent,
} from '@/lib/types/ui';

export const ParallelDispatchView = ({ content }: { content: ParallelDispatchContent }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <div className="text-[10px] text-violet-400 font-bold tracking-tighter flex items-center gap-1">
        <Layers size={12} /> Parallel Dispatch
      </div>
      <div className="p-3 bg-violet-500/5 border border-violet-500/20 rounded text-[11px] font-mono text-white/90">
        Dispatching {content.taskCount} tasks in parallel
      </div>
    </div>
    {content.tasks && content.tasks.length > 0 && (
      <div className="space-y-2">
        <div className="text-[10px] text-white/60 font-bold">Tasks</div>
        <div className="space-y-1">
          {content.tasks.map((t, idx) => (
            <div key={idx} className="p-2 bg-white/[0.02] border border-white/10 rounded text-[10px] font-mono">
              <div className="text-violet-400 font-bold">{t.agentId}</div>
              <div className="text-white/60 truncate">{t.task}</div>
            </div>
          ))}
        </div>
      </div>
    )}
    <div className="flex gap-4">
      <div className="space-y-1">
        <div className="text-[9px] text-white/40 font-bold">Aggregation</div>
        <div className="text-[10px] text-violet-400 font-mono">{content.aggregationType || 'summary'}</div>
      </div>
      <div className="space-y-1">
        <div className="text-[9px] text-white/40 font-bold">Timeout</div>
        <div className="text-[10px] text-violet-400 font-mono">
          {content.barrierTimeoutMs ? `${Math.round(content.barrierTimeoutMs / 1000)}s` : 'N/A'}
        </div>
      </div>
    </div>
  </div>
);

export const ParallelBarrierView = ({ content }: { content: ParallelBarrierContent }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <div className="text-[10px] text-violet-400 font-bold tracking-tighter flex items-center gap-1">
        <Layers size={12} /> Parallel Barrier
      </div>
      <div className="p-3 bg-violet-500/5 border border-violet-500/20 rounded text-[11px] font-mono text-white/90">
        Waiting for {content.taskCount} sub-agents to complete
      </div>
    </div>
    <div className="flex gap-4">
      <div className="space-y-1">
        <div className="text-[9px] text-white/40 font-bold">Status</div>
        <div className="text-[10px] text-violet-400 font-mono">{content.status}</div>
      </div>
      {content.targetTime && (
        <div className="space-y-1">
          <div className="text-[9px] text-white/40 font-bold">Target Time</div>
          <div className="text-[10px] text-violet-400 font-mono">{content.targetTime}</div>
        </div>
      )}
    </div>
  </div>
);

export const CouncilReviewView = ({ content }: { content: CouncilReviewContent }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <div className="text-[10px] text-red-400 font-bold tracking-tighter flex items-center gap-1">
        <Shield size={12} /> Council Review
      </div>
      <div className="p-3 bg-red-500/5 border border-red-500/20 rounded text-[11px] font-mono text-white/90">
        {content.reviewType}
      </div>
    </div>
    <div className="space-y-1">
      <div className="text-[9px] text-white/40 font-bold">Status</div>
      <div className="text-[10px] text-red-400 font-mono">{content.status}</div>
    </div>
  </div>
);

export const ContinuationView = ({ content }: { content: ContinuationContent }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <div className="text-[10px] text-teal-400 font-bold tracking-tighter flex items-center gap-1">
        <GitBranch size={12} /> Continuation
      </div>
      <div className="p-3 bg-teal-500/5 border border-teal-500/20 rounded text-[11px] font-mono text-white/90">
        {content.direction === 'to_initiator' ? 'Result routed back to initiator' : 'Agent resuming with new context'}
      </div>
    </div>
    <div className="flex gap-4">
      <div className="space-y-1">
        <div className="text-[9px] text-white/40 font-bold">Initiator</div>
        <div className="text-[10px] text-teal-400 font-mono">{content.initiatorId || 'N/A'}</div>
      </div>
      <div className="space-y-1">
        <div className="text-[9px] text-white/40 font-bold">Requesting Agent</div>
        <div className="text-[10px] text-teal-400 font-mono">{content.requestingAgent || 'N/A'}</div>
      </div>
    </div>
  </div>
);

export const CircuitBreakerView = ({ content }: { content: CircuitBreakerContent }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <div className="text-[10px] text-orange-400 font-bold tracking-tighter flex items-center gap-1">
        <Cpu size={12} /> Circuit Breaker State Change
      </div>
      <div className="p-3 bg-orange-500/5 border border-orange-500/20 rounded text-[11px] font-mono text-white/90">
        State transitioned from <span className="text-orange-400 font-bold">{content.previousState}</span> to <span className="text-orange-400 font-bold">{content.newState}</span>
      </div>
    </div>
    <div className="space-y-2">
      <div className="text-[10px] text-white/60 font-bold">Reason</div>
      <div className="p-2 bg-white/[0.02] border border-white/10 rounded text-[10px] font-mono text-white/70">{content.reason || 'N/A'}</div>
    </div>
    <div className="flex gap-4">
      <div className="space-y-1">
        <div className="text-[9px] text-white/40 font-bold">Failure Type</div>
        <div className="text-[10px] text-orange-400 font-mono">{content.failureType || 'N/A'}</div>
      </div>
      <div className="space-y-1">
        <div className="text-[9px] text-white/40 font-bold">Failure Count</div>
        <div className="text-[10px] text-orange-400 font-mono">{content.failureCount ?? 0}</div>
      </div>
    </div>
  </div>
);

export const CancellationView = ({ content }: { content: CancellationContent }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <div className="text-[10px] text-rose-400 font-bold tracking-tighter flex items-center gap-1">
        <ShieldAlert size={12} /> Task Cancellation
      </div>
      <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded text-[11px] font-mono text-white/90">
        Task terminated
      </div>
    </div>
    <div className="flex gap-4">
      <div className="space-y-1">
        <div className="text-[9px] text-white/40 font-bold">Task ID</div>
        <div className="text-[10px] text-rose-400 font-mono">{content.taskId ? content.taskId.slice(0, 8) : 'N/A'}</div>
      </div>
      <div className="space-y-1">
        <div className="text-[9px] text-white/40 font-bold">Initiator</div>
        <div className="text-[10px] text-rose-400 font-mono">{content.initiatorId || 'N/A'}</div>
      </div>
    </div>
    <div className="space-y-2">
      <div className="text-[10px] text-white/60 font-bold">Reason</div>
      <div className="p-2 bg-white/[0.02] border border-white/10 rounded text-[10px] font-mono text-white/70">{content.reason || 'No reason provided'}</div>
    </div>
  </div>
);

export const MemoryOperationView = ({ content }: { content: MemoryOperationContent }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <div className="text-[10px] text-cyan-400 font-bold tracking-tighter flex items-center gap-1">
        <Brain size={12} /> Memory Operation
      </div>
      <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded text-[11px] font-mono text-white/90">{content.operation}</div>
    </div>
    <div className="flex gap-4">
      <div className="space-y-1">
        <div className="text-[9px] text-white/40 font-bold">Key</div>
        <div className="text-[10px] text-cyan-400 font-mono">{content.key || 'N/A'}</div>
      </div>
      <div className="space-y-1">
        <div className="text-[9px] text-white/40 font-bold">Scope</div>
        <div className="text-[10px] text-cyan-400 font-mono">{content.scope || 'N/A'}</div>
      </div>
    </div>
  </div>
);

export const ReflectView = ({ content }: { content: ReflectContent }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <div className="text-[10px] text-indigo-400 font-bold tracking-tighter flex items-center gap-1">
        <Brain size={12} /> Agent Reflection
      </div>
      <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded text-[11px] font-mono text-white/90 whitespace-pre-wrap leading-relaxed">
        {content.reflection}
      </div>
    </div>
  </div>
);

export const ResultView = ({ content }: { content: ResultContent }) => (
  <div className="space-y-2">
    <div className="text-[10px] text-cyber-green font-bold">Transmission complete</div>
    <div className="p-3 bg-cyber-green/5 border border-cyber-green/20 rounded text-xs text-white/90 whitespace-pre-wrap">
      {content.response}
    </div>
  </div>
);
