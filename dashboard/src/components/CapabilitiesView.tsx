'use client';

import React, { useState } from 'react';
import { Wrench, Shield, Zap, Cpu, Settings, Save, Search, Trash2 } from 'lucide-react';
import { updateAgentTools, deleteMCPServer } from '../app/capabilities/actions';

interface Tool {
  name: string;
  description: string;
  usage?: {
    count: number;
    lastUsed: number;
  };
}

interface AgentConfig {
  id: string;
  name: string;
  description: string;
  icon?: string;
  tools: string[];
}

interface CapabilitiesViewProps {
  agents: AgentConfig[];
  allTools: Tool[];
  mcpServers: Record<string, any>;
}

export default function CapabilitiesView({ agents, allTools, mcpServers }: CapabilitiesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTools = allTools.filter(tool => 
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-10">
      {/* Search Header */}
      <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
        <div className="relative flex-1 max-w-xl">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={18} className="text-yellow-500/50" />
          </div>
          <input
            type="text"
            placeholder="SEARCH_CAPABILITIES..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-white/5 focus:border-yellow-500/40 rounded-sm py-4 pl-12 pr-4 text-sm outline-none transition-all placeholder:text-white/20 font-mono"
          />
        </div>
        
        <div className="flex gap-4">
            <span className="text-[10px] font-bold text-yellow-500/40 bg-yellow-500/5 px-4 py-2 rounded-sm border border-yellow-500/10 uppercase tracking-[0.3em]">
                {allTools.length} TOTAL_CAPABILITIES
            </span>
            <span className="text-[10px] font-bold text-white/40 bg-white/5 px-4 py-2 rounded-sm border border-white/5 uppercase tracking-[0.3em]">
                {Object.keys(mcpServers).length} MCP_SERVERS
            </span>
        </div>
      </div>

      {/* MCP Servers Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Registered_Neural_Bridges</h4>
            <div className="h-px flex-1 bg-gradient-to-l from-white/10 to-transparent" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(mcpServers).map(([name, config]) => (
                <div key={name} className="glass-card p-4 border-white/5 group hover:border-red-500/20 transition-all">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-[11px] font-black text-white/80 uppercase tracking-widest">{name}</span>
                        <button 
                            onClick={async () => {
                                if (confirm(`Deactivate and unregister ${name}?`)) {
                                    await deleteMCPServer(name);
                                }
                            }}
                            className="p-2 rounded-sm bg-white/5 text-white/20 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                    <div className="space-y-2">
                        <p className="text-[9px] font-mono text-white/30 truncate bg-black/40 p-2 rounded-sm">
                            {typeof config === 'string' ? config : config.command}
                        </p>
                        <div className="flex gap-2">
                            <span className="text-[8px] bg-yellow-500/10 text-yellow-500/60 px-2 py-0.5 rounded-none uppercase font-bold tracking-tighter">
                                ACTIVE
                            </span>
                            {typeof config !== 'string' && config.env && (
                                <span className="text-[8px] bg-blue-500/10 text-blue-500/60 px-2 py-0.5 rounded-none uppercase font-bold tracking-tighter">
                                    ENVS:{Object.keys(config.env).length}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
            {Object.keys(mcpServers).length === 0 && (
                <div className="col-span-full py-8 text-center glass-card border-dashed border-white/5 text-white/10 text-[10px] uppercase tracking-widest">
                    No autonomous MCP expansions recorded.
                </div>
            )}
        </div>
      </section>

      {/* Agents Tools Section */}
      <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-yellow-500/10 to-transparent" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-yellow-500/40">Agent_Neural_Assignment</h4>
            <div className="h-px flex-1 bg-gradient-to-l from-yellow-500/10 to-transparent" />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {agents.map(agent => (
          <form key={agent.id} action={updateAgentTools} className="glass-card p-6 space-y-6 cyber-border border-yellow-500/10 hover:border-yellow-500/20 transition-all">
            <input type="hidden" name="agentId" value={agent.id} />
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.05)]">
                   {agent.id === 'main' ? <Zap size={20} /> : agent.id === 'coder' ? <Cpu size={20} /> : <Settings size={20} />}
                </div>
                <div>
                  <h3 className="text-sm font-black text-yellow-500 uppercase tracking-[0.2em]">
                    {agent.name}
                  </h3>
                  <p className="text-[9px] text-white/40 uppercase tracking-widest truncate max-w-[200px]">
                    {agent.description || 'Specialized Neural Node'}
                  </p>
                </div>
              </div>
              <button 
                type="submit"
                className="text-[10px] font-black px-4 py-2 rounded-sm bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-all flex items-center gap-2 border border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.1)] uppercase tracking-widest"
              >
                <Save size={12} /> SYNC_ROSTER
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar border-t border-white/5 pt-4">
              {filteredTools.map(tool => {
                const isEnabled = agent.tools.includes(tool.name);
                return (
                  <label 
                    key={tool.name} 
                    className={`flex items-start gap-4 p-4 rounded-sm border transition-all cursor-pointer group ${
                      isEnabled 
                        ? 'bg-yellow-500/5 border-yellow-500/30 text-white shadow-[inset_0_0_15px_rgba(234,179,8,0.02)]' 
                        : 'bg-white/[0.01] border-white/5 text-white/30 hover:border-white/20 hover:bg-white/[0.03]'
                    }`}
                  >
                    <input 
                      type="checkbox" 
                      name="tools" 
                      value={tool.name} 
                      defaultChecked={isEnabled}
                      className="mt-1 accent-yellow-500 w-4 h-4 rounded-none border-white/20"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[11px] font-black uppercase tracking-[0.1em] ${isEnabled ? 'text-yellow-500' : 'text-white/60'}`}>
                          {tool.name}
                        </span>
                        <div className="flex items-center gap-3">
                          {tool.usage && tool.usage.count > 0 && (
                            <span className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">
                              {tool.usage.count} CALLS
                            </span>
                          )}
                          {tool.name === 'fileWrite' && <Shield size={10} className="text-red-500/60" />}
                        </div>
                      </div>
                      <p className={`text-[10px] leading-relaxed font-light ${isEnabled ? 'text-white/70' : 'text-white/20'}`}>
                        {tool.description}
                      </p>
                      {tool.usage && tool.usage.lastUsed > 0 && (
                         <p className="text-[8px] mt-2 text-white/10 uppercase tracking-widest">
                           Last Used: {new Date(tool.usage.lastUsed).toLocaleString()}
                         </p>
                      )}
                    </div>
                  </label>
                );
              })}
              {filteredTools.length === 0 && (
                <div className="py-10 text-center space-y-3 opacity-20">
                    <Search size={32} className="mx-auto" />
                    <p className="text-[10px] uppercase tracking-widest">No tools match your query</p>
                </div>
              )}
            </div>
          </form>
        ))}
      </div>
    </section>
  </div>
);
}
