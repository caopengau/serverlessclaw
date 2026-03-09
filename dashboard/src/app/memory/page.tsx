import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { 
  Database, 
  History, 
  Wrench, 
  Clock, 
  Brain,
  Search,
  ChevronRight,
  Shield
} from 'lucide-react';
import { tools } from '@/lib/tool-definitions';

async function getMemoryData() {
  try {
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);
    
    const { Items } = await docClient.send(
      new ScanCommand({
        TableName: Resource.MemoryTable.name,
      })
    );
    
    return Items || [];
  } catch (e) {
    console.error('Error fetching memory data:', e);
    return [];
  }
}

export default async function MemoryVault() {
  const allItems = await getMemoryData();
  
  const distilled = allItems
    .filter(item => item.userId?.startsWith('DISTILLED#'))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
  const sessions = Array.from(new Set(allItems
    .filter(item => !item.userId?.includes('#') && !item.id)
    .map(item => item.userId)))
    .map(userId => ({
      userId,
      lastActive: Math.max(...allItems
        .filter(item => item.userId === userId)
        .map(item => item.timestamp || 0))
    }))
    .sort((a, b) => b.lastActive - a.lastActive);

  const toolList = Object.values(tools);

  return (
    <main className="flex-1 overflow-y-auto p-10 space-y-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyber-blue/5 via-transparent to-transparent">
      <header className="flex justify-between items-end border-b border-white/5 pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight glow-text-blue">MEMORY_VAULT</h2>
          <p className="text-white/40 text-sm mt-2 font-light">Repository of distilled intelligence, session context, and agent arsenal.</p>
        </div>
        <div className="flex gap-4">
          <div className="glass-card px-4 py-2 text-[12px]">
            <div className="text-white/30 mb-1">FACTS_STORED</div>
            <div className="font-bold text-cyber-blue">{distilled.length}</div>
          </div>
          <div className="glass-card px-4 py-2 text-[12px]">
            <div className="text-white/30 mb-1">ACTIVE_SESSIONS</div>
            <div className="font-bold">{sessions.length}</div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        {/* Left: Distilled Facts & Sessions */}
        <div className="xl:col-span-8 space-y-12">
          {/* Distilled Facts */}
          <section>
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 flex items-center gap-2 mb-6">
              <Brain size={14} className="text-cyber-blue" /> Distilled Intel (Long-Term)
            </h3>
            <div className="grid gap-4">
              {distilled.length > 0 ? (
                distilled.map((fact, i) => (
                  <div key={i} className="glass-card p-5 border-cyber-blue/10 bg-cyber-blue/[0.02] relative group">
                    <div className="absolute top-4 right-4 text-[10px] text-white/20">
                      {new Date(fact.timestamp).toLocaleDateString()}
                    </div>
                    <div className="text-[10px] text-cyber-blue/60 font-bold mb-2 uppercase tracking-widest">
                      {fact.userId.replace('DISTILLED#', 'AGENT_REF::')}
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed font-mono italic">
                      {fact.content}
                    </p>
                  </div>
                ))
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-white/20 border border-dashed border-white/10 rounded-lg">
                  <Search size={24} className="mb-2 opacity-20" />
                  <p className="text-xs">NO_DISTILLED_FACTS_FOUND</p>
                </div>
              )}
            </div>
          </section>

          {/* Session Registry */}
          <section>
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 flex items-center gap-2 mb-6">
              <History size={14} className="text-white/40" /> Active Session Registry
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map((session, i) => (
                <div key={i} className="glass-card p-4 hover:bg-white/[0.05] transition-all cursor-pointer group flex justify-between items-center border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center text-white/20">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white/80">ID: {session.userId}</div>
                      <div className="text-[10px] text-white/30 flex items-center gap-1 mt-1">
                        <Clock size={10} /> {new Date(session.lastActive).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-white/10 group-hover:text-cyber-green transition-colors" />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right: Tool Arsenal */}
        <div className="xl:col-span-4 space-y-8">
          <section className="glass-card p-6 border-white/10 bg-black/40 sticky top-10">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 flex items-center gap-2 mb-6">
              <Wrench size={14} className="text-yellow-500" /> Active Arsenal (Tools)
            </h3>
            
            <div className="space-y-4">
              {toolList.map((tool, i) => (
                <div key={i} className="p-3 bg-white/[0.02] border border-white/5 rounded group hover:border-yellow-500/30 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-yellow-500/80">{tool.name}</span>
                    <Shield size={10} className="text-white/20 group-hover:text-cyber-green" />
                  </div>
                  <p className="text-[10px] text-white/40 leading-tight">
                    {tool.description}
                  </p>
                  {tool.parameters && (
                    <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap gap-1">
                      {Object.keys(tool.parameters.properties || {}).map(param => (
                        <span key={param} className="text-[8px] px-1.5 py-0.5 rounded-sm bg-black/40 text-cyber-blue font-mono border border-cyber-blue/20">
                          {param}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <p className="text-[9px] text-white/20 uppercase tracking-widest font-bold">Autonomous Skillcap: {toolList.length}/∞</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
