import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Activity, ShieldCheck, Cpu, Terminal, Clock, ChevronRight } from 'lucide-react';

async function getTraces() {
  try {
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);
    
    const { Items } = await docClient.send(
      new ScanCommand({
        TableName: Resource.TraceTable.name,
        Limit: 10,
      })
    );
    
    return (Items || []).sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    console.error('Error fetching traces:', e);
    return [];
  }
}

export default async function Dashboard() {
  const traces = await getTraces();

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-[#ededed] font-mono">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 flex flex-col p-6 space-y-8 bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-cyber-green rounded-sm flex items-center justify-center text-black font-bold">
            C
          </div>
          <h1 className="text-xl font-bold tracking-tighter">CLAW_MONITOR</h1>
        </div>

        <nav className="flex-1 space-y-4 text-sm">
          <div className="text-white/40 px-2 uppercase text-[10px] tracking-widest font-bold">System</div>
          <a href="#" className="flex items-center gap-3 px-2 py-2 bg-white/5 rounded text-cyber-green">
            <Activity size={16} /> TRACE_INTEL
          </a>
          <a href="#" className="flex items-center gap-3 px-2 py-2 hover:bg-white/5 transition-colors text-white/60">
            <ShieldCheck size={16} /> SELF_HEALING
          </a>
          <a href="#" className="flex items-center gap-3 px-2 py-2 hover:bg-white/5 transition-colors text-white/60">
            <Cpu size={16} /> INFRA_EVOLUTION
          </a>
        </nav>

        <div className="pt-6 border-t border-white/5">
          <div className="text-[10px] text-white/30">VERSION: 1.0.0-PROTOTYPE</div>
          <div className="text-[10px] text-cyber-green mt-1 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber-green"></span>
            </span>
            SYSTEM_ONLINE
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-10 space-y-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyber-green/5 via-transparent to-transparent">
        <header className="flex justify-between items-end border-b border-white/5 pb-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight glow-text">TRACE_INTELLIGENCE</h2>
            <p className="text-white/40 text-sm mt-2 font-light">Real-time observer of autonomous agent neural paths.</p>
          </div>
          <div className="flex gap-4">
            <div className="glass-card px-4 py-2 text-[12px]">
              <div className="text-white/30 mb-1">TOTAL_OPS</div>
              <div className="font-bold">{traces.length}</div>
            </div>
            <div className="glass-card px-4 py-2 text-[12px] border-cyber-green/30">
              <div className="text-white/30 mb-1 text-cyber-green/60">ACTIVE_AGENTS</div>
              <div className="font-bold">3</div>
            </div>
          </div>
        </header>

        {/* Traces Grid */}
        <section className="space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 flex items-center gap-2">
            <Terminal size={14} className="text-cyber-green" /> Recent Neural Paths
          </h3>
          
          <div className="grid gap-3">
            {traces.length > 0 ? (
              traces.map((trace: any) => (
                <div key={trace.traceId} className="glass-card p-4 hover:bg-white/[0.05] transition-all cursor-pointer group cyber-border">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="text-cyber-green/80 text-xs font-bold">[{trace.status.toUpperCase()}]</div>
                      <div className="text-sm font-medium text-white/90">{trace.initialContext?.userText || 'System Task'}</div>
                    </div>
                    <div className="flex items-center gap-6 text-[12px] text-white/30">
                      <div className="flex items-center gap-2">
                        <Clock size={12} /> {new Date(trace.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="group-hover:text-cyber-green transition-colors">
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {trace.steps?.slice(0, 5).map((step: any, i: number) => (
                      <span key={i} className={`text-[9px] px-2 py-0.5 rounded-full border ${
                        step.type === 'tool_call' ? 'border-cyber-blue/30 text-cyber-blue' : 
                        step.type === 'error' ? 'border-red-500/30 text-red-400' : 'border-white/10 text-white/40'
                      }`}>
                        {step.type.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-white/20 border border-dashed border-white/10 rounded-lg">
                <Terminal size={24} className="mb-2 opacity-20" />
                <p className="text-xs">NO_TRACES_FOUND // SYSTEM_IDLE</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
