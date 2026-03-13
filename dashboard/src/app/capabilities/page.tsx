export const dynamic = 'force-dynamic';
import { AlertCircle } from 'lucide-react';
import { tools } from '@/lib/tool-definitions';
import CapabilitiesView from '@/components/CapabilitiesView';
import Typography from '@/components/ui/Typography';
import Badge from '@/components/ui/Badge';

async function getMCPServers() {
  try {
    const { AgentRegistry } = await import('@claw/core/lib/registry');
    return (await AgentRegistry.getRawConfig('mcp_servers')) as Record<string, any> || {};
  } catch (e) {
    console.error('Error fetching MCP servers:', e);
    return {};
  }
}

async function getAllTools(usage: Record<string, { count: number; lastUsed: number }>) {
  try {
    const { MCPBridge } = await import('@claw/core/lib/mcp');
    
    // 1. Local tools
    const localTools = Object.values(tools).map(t => ({
      name: t.name,
      description: t.description,
      usage: usage[t.name] || { count: 0, lastUsed: 0 },
      isExternal: false
    }));

    // 2. MCP tools
    const externalTools = await MCPBridge.getAllExternalTools();
    const mcpTools = externalTools.map(t => ({
      name: t.name,
      description: t.description,
      usage: usage[t.name] || { count: 0, lastUsed: 0 },
      isExternal: true
    }));

    return [...localTools, ...mcpTools];
  } catch (e) {
    console.error('Error fetching all tools:', e);
    return Object.values(tools).map(t => ({
      name: t.name,
      description: t.description,
      usage: usage[t.name] || { count: 0, lastUsed: 0 },
      isExternal: false
    }));
  }
}

async function getToolUsage() {
  try {
    const { AgentRegistry } = await import('@claw/core/lib/registry');
    return (await AgentRegistry.getRawConfig('tool_usage')) as Record<string, { count: number; lastUsed: number }> || {};
  } catch (e) {
    console.error('Error fetching tool usage:', e);
    return {};
  }
}

async function getAgentConfigs() {
  try {
    const { AgentRegistry } = await import('@claw/core/lib/registry');
    const configs = await AgentRegistry.getAllConfigs();
    return Object.values(configs).map(c => ({
      id: c.id,
      name: c.name,
      tools: c.tools || []
    }));
  } catch (e) {
    console.error('Error fetching agent configs:', e);
    return [];
  }
}

export default async function CapabilitiesPage() {
  const [usage, mcpServers, agents] = await Promise.all([
    getToolUsage(),
    getMCPServers(),
    getAgentConfigs()
  ]);
  const allTools = await getAllTools(usage);

  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyber-blue/5 via-transparent to-transparent">
      <header className="flex justify-between items-end border-b border-white/5 pb-6">
        <div>
          <Typography variant="h2" color="white" glow uppercase>
            Tools & Skills
          </Typography>
          <Typography variant="body" color="muted" className="mt-2 block">
            Neural Skill Discovery & External Bridge Management.
          </Typography>
        </div>
        <div className="flex gap-4">
            <div className="flex flex-col items-center text-center">
                <Typography variant="mono" color="muted" className="text-[10px] uppercase tracking-widest opacity-40 mb-1">LOCAL</Typography>
                <Badge variant="outline" className="px-4 py-1 font-bold text-xs border-yellow-500/20 text-yellow-500/60 uppercase">{allTools.filter(t => !t.isExternal).length}</Badge>
            </div>
            <div className="flex flex-col items-center text-center">
                <Typography variant="mono" color="muted" className="text-[10px] uppercase tracking-widest opacity-40 mb-1">BRIDGES</Typography>
                <Badge variant="outline" className="px-4 py-1 font-bold text-xs border-cyber-blue/20 text-cyber-blue/60 uppercase">{Object.keys(mcpServers).length}</Badge>
            </div>
        </div>
      </header>

      <CapabilitiesView 
        allTools={allTools} 
        mcpServers={mcpServers}
        agents={agents}
      />

      <div className="glass-card p-6 border-white/5 text-white/40 flex items-center gap-4">
        <AlertCircle size={20} className="text-[var(--cyber-blue)]/60 shrink-0" />
        <p className="text-[10px] uppercase tracking-widest leading-relaxed">
          [SYSTEM_ADVISORY]: This registry defines the global functional baseline. To assign these tools to specific agents, 
          navigate to the <span className="text-[var(--cyber-blue)] mx-1 font-bold">Agents</span> page and select "Configure Tools" for the desired entity.
        </p>
      </div>
    </main>
  );
}
