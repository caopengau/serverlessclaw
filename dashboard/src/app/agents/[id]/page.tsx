import React from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Shield, 
  Zap, 
  History, 
  TrendingUp, 
  AlertTriangle,
  Settings,
  Bot
} from 'lucide-react';
import { AgentRegistry } from '@claw/core/lib/registry/AgentRegistry';
import { DynamoMemory, getReputation } from '@claw/core/lib/memory';
import Typography from '@/components/ui/Typography';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/PageHeader';
import AgentEvolutionCharts from '@/components/Agent/AgentEvolutionCharts';
import AgentTuningHub from '@/components/Agent/AgentTuningHub';

export const dynamic = 'force-dynamic';

async function getAgentData(id: string) {
  const config = await AgentRegistry.getAgentConfig(id);
  const memory = new DynamoMemory();
  const reputation = await getReputation(memory, id);
  
  return { config, reputation };
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { config, reputation } = await getAgentData(id);

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white/40">
        <AlertTriangle size={48} className="mb-4 text-red-500" />
        <Typography variant="h2" weight="bold" color="white">Agent Not Found</Typography>
        <Link href="/agents" className="mt-4 text-cyber-blue hover:underline">Return to Registry</Link>
      </div>
    );
  }

  const successRate = reputation?.successRate ?? 0;
  const avgLatency = reputation?.avgLatencyMs ?? 0;
  const totalTasks = (reputation?.tasksCompleted ?? 0) + (reputation?.tasksFailed ?? 0);

  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyber-blue/5 via-transparent to-transparent">
      <header>
        <Link href="/agents" className="group">
          <Typography
            variant="caption"
            color="white"
            weight="bold"
            className="flex items-center gap-2 mb-6 hover:text-cyber-green transition-colors"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> 
            Back to Registry
          </Typography>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-cyber-blue/10 border border-cyber-blue/20 flex items-center justify-center shadow-[0_0_30px_rgba(0,243,255,0.1)]">
              <Bot size={32} className="text-cyber-blue" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Typography variant="h1" weight="bold" className="tracking-tighter">
                  {config.name}
                </Typography>
                <Badge variant={config.enabled ? "primary" : "outline"} className="uppercase text-[9px] px-2">
                  {config.enabled ? "Active" : "Disabled"}
                </Badge>
                {config.isBackbone && (
                  <Badge variant="outline" className="border-red-500/20 text-red-400 uppercase text-[9px] px-2 flex items-center gap-1">
                    <Shield size={10} /> Backbone
                  </Badge>
                )}
              </div>
              <Typography variant="mono" color="muted" className="text-xs">
                ID: {id} • v{config.version || 1} • {config.provider}/{config.model}
              </Typography>
            </div>
          </div>

          <div className="flex gap-4">
            <Card variant="glass" className="px-4 py-2 border-white/5 bg-white/[0.02] flex items-center gap-3">
              <TrendingUp size={16} className="text-cyber-green" />
              <div>
                <Typography variant="mono" color="muted" className="text-[9px] uppercase tracking-widest block opacity-50">Success Rate</Typography>
                <Typography variant="mono" weight="bold" color="white" className="text-sm">{(successRate * 100).toFixed(1)}%</Typography>
              </div>
            </Card>
            <Card variant="glass" className="px-4 py-2 border-white/5 bg-white/[0.02] flex items-center gap-3">
              <Zap size={16} className="text-yellow-400" />
              <div>
                <Typography variant="mono" color="muted" className="text-[9px] uppercase tracking-widest block opacity-50">Avg Latency</Typography>
                <Typography variant="mono" weight="bold" color="white" className="text-sm">{avgLatency.toFixed(0)}ms</Typography>
              </div>
            </Card>
            <Card variant="glass" className="px-4 py-2 border-white/5 bg-white/[0.02] flex items-center gap-3">
              <History size={16} className="text-cyber-blue" />
              <div>
                <Typography variant="mono" color="muted" className="text-[9px] uppercase tracking-widest block opacity-50">Total Tasks</Typography>
                <Typography variant="mono" weight="bold" color="white" className="text-sm">{totalTasks}</Typography>
              </div>
            </Card>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Performance & Evolution Charts */}
        <div className="lg:col-span-2 space-y-8">
          <AgentEvolutionCharts agentId={id} currentVersion={config.version || 1} />
          
          <Card variant="glass" className="overflow-hidden border-white/5">
            <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-cyber-blue" />
                <Typography variant="mono" weight="bold" uppercase className="text-xs tracking-widest">Core Directive</Typography>
              </div>
            </div>
            <div className="p-6 bg-black/40">
              <pre className="text-xs font-mono text-white/80 whitespace-pre-wrap leading-relaxed">
                {config.systemPrompt}
              </pre>
            </div>
          </Card>
        </div>

        {/* Right Column: Tuning Hub & Error Dist */}
        <div className="space-y-8">
          <AgentTuningHub 
            agentId={id} 
            lastTraceId={reputation?.lastTraceId} 
            errorDistribution={reputation?.errorDistribution}
          />
        </div>
      </div>
    </main>
  );
}
