'use client';

import React from 'react';
import { Brain, X } from 'lucide-react';
import { TRACE_TYPES } from '@/lib/constants';
import Button from '@/components/ui/Button';
import Typography from '@/components/ui/Typography';
import { THEME } from '@/lib/theme';
import { TraceStep } from '@/lib/types/ui';
import { LlmCallView, LlmResponseView } from './StepViews/LlmViews';
import { ToolCallView, ToolResultView, ErrorView } from './StepViews/ToolViews';
import { ClarificationView, AgentStateView } from './StepViews/AgentViews';
import {
  ParallelDispatchView,
  ParallelBarrierView,
  CouncilReviewView,
  ContinuationView,
  CircuitBreakerView,
  CancellationView,
  MemoryOperationView,
  ReflectView,
  ResultView,
} from './StepViews/OtherViews';

interface StepDetailPanelProps {
  selectedStep: TraceStep;
  onClose: () => void;
}

export default function StepDetailPanel({ selectedStep, onClose }: StepDetailPanelProps) {
  const renderContent = () => {
    switch (selectedStep.type) {
      case TRACE_TYPES.LLM_CALL:
        return <LlmCallView content={selectedStep.content} />;
      case TRACE_TYPES.LLM_RESPONSE:
        return <LlmResponseView content={selectedStep.content} />;
      case TRACE_TYPES.TOOL_CALL:
        return <ToolCallView content={selectedStep.content} />;
      case TRACE_TYPES.TOOL_RESULT:
      case TRACE_TYPES.TOOL_RESPONSE:
        return <ToolResultView content={selectedStep.content} />;
      case TRACE_TYPES.ERROR:
        return <ErrorView content={selectedStep.content} />;
      case TRACE_TYPES.CLARIFICATION_REQUEST:
        return <ClarificationView content={selectedStep.content} />;
      case TRACE_TYPES.AGENT_WAITING:
      case TRACE_TYPES.AGENT_RESUMED:
        return <AgentStateView content={selectedStep.content} type={selectedStep.type} />;
      case TRACE_TYPES.PARALLEL_DISPATCH:
        return <ParallelDispatchView content={selectedStep.content} />;
      case TRACE_TYPES.PARALLEL_BARRIER:
      case TRACE_TYPES.PARALLEL_COMPLETED:
        return <ParallelBarrierView content={selectedStep.content} />;
      case TRACE_TYPES.COUNCIL_REVIEW:
        return <CouncilReviewView content={selectedStep.content} />;
      case TRACE_TYPES.CONTINUATION:
        return <ContinuationView content={selectedStep.content} />;
      case TRACE_TYPES.CIRCUIT_BREAKER:
        return <CircuitBreakerView content={selectedStep.content} />;
      case TRACE_TYPES.CANCELLATION:
        return <CancellationView content={selectedStep.content} />;
      case TRACE_TYPES.MEMORY_OPERATION:
        return <MemoryOperationView content={selectedStep.content} />;
      case TRACE_TYPES.REFLECT:
        return <ReflectView content={selectedStep.content} />;
      case 'result':
        return <ResultView content={selectedStep.content} />;
      case 'trigger':
        return (
          <div className="space-y-2">
            <div className="text-[10px] text-white/60 font-bold">Initial context</div>
            <div className="p-3 bg-white/[0.02] border border-white/10 rounded text-xs text-white/80">
              {JSON.stringify(selectedStep.content, null, 2)}
            </div>
          </div>
        );
      default:
        return (
          <div className="text-xs text-muted-foreground italic">
            Unknown step type: {selectedStep.type}
          </div>
        );
    }
  };

  return (
    <div className="absolute top-4 right-4 bottom-4 w-96 bg-[#0a0f1a]/95 border border-cyber-green/30 shadow-[0_0_30px_rgba(0,255,163,0.1)] z-50 rounded-lg flex flex-col animate-in slide-in-from-right-10 duration-300">
      <header className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40 shrink-0">
        <div className="flex items-center gap-2">
          <Brain size={16} className={`text-${THEME.COLORS.PRIMARY}`} />
          <Typography variant="caption" weight="black" className="tracking-[0.2em]">
            Step details
          </Typography>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-white/40 hover:text-white p-2 h-auto"
          icon={<X size={16} />}
        />
      </header>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
        <div className="space-y-1">
          <Typography
            variant="mono"
            weight="bold"
            color="primary"
            className="text-[9px] tracking-tighter"
          >
            Event type
          </Typography>
          <Typography
            variant="caption"
            weight="bold"
            color="white"
            className="bg-white/5 p-2 rounded border border-white/5 capitalize block"
          >
            {selectedStep.type.replace(/_/g, ' ')}
          </Typography>
        </div>

        {renderContent()}
      </div>

      <footer className="p-3 border-t border-white/10 bg-black/20 shrink-0 flex justify-between">
        <Typography
          variant="mono"
          color="muted"
          className="text-[7px] tracking-widest italic opacity-40"
        >
          ID: {selectedStep.stepId?.substring(0, 8) || 'N/A'}
        </Typography>
        <Typography
          variant="mono"
          color="muted"
          className="text-[7px] tracking-widest italic opacity-40"
        >
          {selectedStep.timestamp ? new Date(selectedStep.timestamp).toLocaleTimeString() : ''}
        </Typography>
      </footer>
    </div>
  );
}
