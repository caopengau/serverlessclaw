'use client';

import React, { useEffect, useState } from 'react';
import { Brain, Activity, Target, ShieldAlert, Cpu } from 'lucide-react';
import Typography from '@/components/ui/Typography';
import Card from '@/components/ui/Card';
import CognitiveHealthCard from '@/components/CognitiveHealthCard';
import { Anomaly } from '@/lib/types/dashboard';

interface AgentHealth {
  agentId: string;
  score: number;
  taskCompletionRate: number;
  reasoningCoherence: number;
  errorRate: number;
  memoryFragmentation: number;
  anomalies: Anomaly[];
}

export default function CognitiveView() {
  const [agents, setAgents] = useState<AgentHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cognitive-health')
      .then((res) => res.json())
      .then((data) => setAgents(data.agents ?? []))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.length > 0 ? (
          agents.map((agent) => <CognitiveHealthCard key={agent.agentId} {...agent} />)
        ) : (
          <div className="col-span-full h-48 flex flex-col items-center justify-center opacity-20 border-dashed border-2 border-border rounded-xl">
            <Brain size={32} className="mb-4" />
            <Typography variant="body">No active cognitive traces</Typography>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card variant="glass" padding="lg" className="border-cyan-500/10 bg-cyan-500/[0.02]">
          <Typography
            variant="caption"
            weight="black"
            className="tracking-widest flex items-center gap-2 mb-4 text-cyan-400"
          >
            <Cpu size={14} /> Neural_Sync_Status
          </Typography>
          <div className="space-y-4 font-mono text-[10px]">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-muted-foreground">COHERENCE_AVG</span>
              <span className="text-cyan-400 font-bold">98.2%</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-muted-foreground">LATENCY_P99</span>
              <span className="text-cyan-400 font-bold">1.2s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CROSS_AGENT_TRUST</span>
              <span className="text-cyber-green font-bold text-[8px] uppercase tracking-tighter">
                [OPTIMAL]
              </span>
            </div>
          </div>
        </Card>

        <Card variant="outline" padding="lg" className="border-border/30 bg-card/20">
          <Typography variant="caption" weight="bold" className="mb-2 flex items-center gap-2">
            <Target size={14} className="text-cyber-green" /> Objective Alignment
          </Typography>
          <Typography variant="body" className="text-xs opacity-70 leading-relaxed block">
            The Cognitive Sector analyzes the reasoning patterns of the active swarm. Score
            represents the alignment between intent and action. Anomalies are detected using
            high-entropy variance analysis in the trace logs.
          </Typography>
        </Card>
      </div>
    </div>
  );
}
