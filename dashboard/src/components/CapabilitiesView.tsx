'use client';

import React, { useState, useTransition } from 'react';
import { Wrench, Shield, Zap, Cpu, Settings, Save, Search, Trash2, X, Plus, Activity, BookOpen, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { updateAgentTools, deleteMCPServer, registerMCPServer } from '../app/capabilities/actions';
import { toast } from 'sonner';
import CyberConfirm from './CyberConfirm';
import { useRouter } from 'next/navigation';
import { Globe, Loader2 } from 'lucide-react';
import Button from './ui/Button';
import Typography from './ui/Typography';
import Card from './ui/Card';
import Badge from './ui/Badge';

interface Tool {
  name: string;
  description: string;
  isExternal?: boolean;
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
  allTools: Tool[];
  mcpServers: Record<string, any>;
}

export default function CapabilitiesView({ allTools, mcpServers }: CapabilitiesViewProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'library' | 'mcp'>('library');
  const [isPending, startTransition] = useTransition();

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'warning'
  });


  const filteredTools = allTools.filter(tool => 
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const executeToggle = (agentId: string, toolName: string, isRemoval: boolean) => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleRemoveMCPServer = (name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Bridge Deactivation',
      message: `You are about to unregister the skill bridge '${name}'. All associated tools will be removed from the system. Proceed?`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        startTransition(async () => {
          const result = await deleteMCPServer(name);
          if (result?.error) {
            toast.error(`Failed to deactivate bridge: ${result.error}`);
          } else {
            toast.success(`Skill bridge '${name}' deactivated`);
            router.refresh();
          }
        });
      }
    });
  };

  const universalSkills = ['discoverSkills', 'installSkill'];

  return (
    <div className={`space-y-10 transition-all duration-500 ${isPending ? 'opacity-80' : 'opacity-100'}`}>
      <CyberConfirm 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
      {isPending && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <Card variant="glass" padding="lg" className="flex flex-col items-center gap-6 border-yellow-500/20 shadow-[0_0_50px_rgba(234,179,8,0.1)]">
            <Zap size={48} className="text-yellow-500 animate-pulse" />
            <div className="space-y-2 text-center">
               <Typography variant="caption" weight="black" color="primary" className="tracking-[0.5em] block">Updating Agent Tools...</Typography>
              <Typography variant="mono" color="muted" className="tracking-[0.3em] block text-[8px]">Synchronizing System Capabilities</Typography>
            </div>
          </Card>
        </div>
      )}
      {/* Navigation & Search */}
      <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center sticky top-0 z-20 bg-black/80 backdrop-blur-xl p-4 -m-4 border-b border-white/5">
        <nav className="flex gap-1 bg-white/5 p-1 rounded-sm border border-white/5">
          {[
            { id: 'library', label: 'Tool Library', icon: BookOpen },
            { id: 'mcp', label: 'Skill Bridges', icon: ExternalLink },
          ].map(tab => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab.id as any)}
              icon={<tab.icon size={12} />}
              className={`px-6 font-black tracking-widest transition-all ${
                activeTab === tab.id 
                  ? 'shadow-[0_0_20px_rgba(234,179,8,0.2)]' 
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tab.label}
            </Button>
          ))}
        </nav>

        <div className="relative flex-1 max-w-xl">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={16} className="text-yellow-500/50" />
          </div>
          <input
            type="text"
            placeholder="Search tools & skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/60 border border-white/10 focus:border-yellow-500/40 rounded-sm py-3 pl-12 pr-4 text-[10px] outline-none transition-all placeholder:text-white/20 font-mono tracking-widest"
          />
        </div>
      </div>

      {activeTab === 'mcp' && (
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(mcpServers).map(([name, config]) => (
                  <Card variant="glass" padding="md" key={name} className="group hover:border-red-500/20 transition-all relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none" />
                      <div className="flex justify-between items-start mb-6 relative">
                          <div>
                            <Typography variant="body" weight="black" color="white" className="tracking-[0.2em] mb-1">{name}</Typography>
                            <Badge variant="primary" className="bg-yellow-500/10 text-yellow-500/60 font-bold">
                                Bridge Active
                            </Badge>
                          </div>
                          <Button 
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMCPServer(name)}
                              className="opacity-0 group-hover:opacity-100 border border-white/10 hover:bg-red-500 hover:text-white p-2"
                              icon={<Trash2 size={14} />}
                          />
                      </div>
                      <div className="space-y-4 relative">
                          <p className="text-[10px] font-mono text-white/40 break-all bg-black/60 p-3 rounded-sm border border-white/5 leading-relaxed">
                              {typeof config === 'string' ? config : config.command}
                          </p>
                          {typeof config !== 'string' && config.env && (
                              <div className="flex flex-wrap gap-2">
                                  {Object.keys(config.env).map(key => (
                                    <Badge key={key} variant="primary" className="border-blue-500/20 text-blue-500/60 font-bold uppercase py-0 text-[8px]">
                                        {key}
                                    </Badge>
                                  ))}
                              </div>
                          )}
                      </div>
                  </Card>
              ))}
              {Object.keys(mcpServers).length === 0 && (
                  <Card variant="solid" padding="lg" className="col-span-full py-20 text-center border-dashed border-white/10">
                      <Typography variant="caption" color="muted" uppercase className="tracking-[0.5em]">No active skill bridges detected.</Typography>
                  </Card>
              )}
          </div>
        </section>
      )}


      {activeTab === 'library' && (
        <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTools.map(tool => (
                <Card variant="solid" padding="lg" key={tool.name} className={`flex flex-col justify-between hover:border-yellow-500/20 transition-all ${tool.isExternal ? 'border-purple-500/10' : 'border-white/5'}`}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-1">
                        <Typography variant="body" weight="black" color={tool.isExternal ? 'intel' : 'primary'} className="tracking-widest">
                          {tool.name}
                        </Typography>
                        {tool.isExternal && <Typography variant="mono" color="muted" className="tracking-tighter block text-[7px] opacity-40">External MCP Bridge</Typography>}
                      </div>
                      {tool.usage && tool.usage.count > 0 && (
                        <div className="flex items-center gap-1 text-white/20">
                          <Activity size={10} />
                          <span className="text-[9px] font-bold">{tool.usage.count}</span>
                        </div>
                      )}
                    </div>
                    <Typography variant="caption" color="muted" className="leading-relaxed tracking-widest block">
                      {tool.description}
                    </Typography>
                  </div>
                  
                  {tool.usage && tool.usage.lastUsed > 0 && (
                    <div className="mt-6 pt-4 border-t border-white/5">
                      <Typography variant="mono" color="muted" className="tracking-[0.2em] block text-[8px] opacity-40">
                        Last Invocation: {new Date(tool.usage.lastUsed).toLocaleString()}
                      </Typography>
                    </div>
                  )}
                </Card>
              ))}
           </div>
        </section>
      )}
    </div>
  );
}
