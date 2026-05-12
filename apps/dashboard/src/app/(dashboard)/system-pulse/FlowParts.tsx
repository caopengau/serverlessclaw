import React from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Zap,
  Brain,
  Activity,
  Search,
  FlaskConical,
  Settings2,
  Radio,
  Info,
  LayoutDashboard,
  MessageSquare,
  Bot,
  Code,
  Globe,
  MessageCircle,
  Hammer,
  Bell,
  Calendar,
  Database,
} from 'lucide-react';

/**
 * Maps agnostic icon keys to Lucide components.
 */
export const ICON_COMPONENTS: Record<string, typeof Bot> = {
  APP: Globe,
  BOT: Bot,
  BRAIN: Brain,
  BUS: MessageCircle,
  DATABASE: Database,
  DASHBOARD: LayoutDashboard,
  HAMMER: Hammer,
  RADIO: Radio,
  SEND: MessageSquare,
  SIGNAL: Zap,
  STETHOSCOPE: Activity,
  ZAP: Zap,
  CODE: Code,
  SEARCH: Search,
  QA: FlaskConical,
  GEAR: Settings2,
  BELL: Bell,
  CALENDAR: Calendar,
};

/**
 * Data structure for React Flow nodes in the topology map.
 */
export interface FlowNodeData {
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  type: string;
  tier: string;
}

/**
 * Interface for the infrastructure topology blueprint.
 */
export interface BlueprintNode {
  id: string;
  type: string;
  tier: string;
  label: string;
  description?: string;
  icon?: string;
  iconType?: string;
  enabled?: boolean;
}

export interface BlueprintEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface BlueprintTopology {
  nodes: BlueprintNode[];
  edges: BlueprintEdge[];
}

/**
 * Visual constants for the flow components to avoid magic literals.
 */
export const FLOW_COLORS = {
  CYBER_BLUE: '#00f3ff',
  NEON_GREEN: '#00ffa3',
  VIVID_ORANGE: '#f97316',
  SKY_BLUE: '#00d4ff',
  VIVID_YELLOW: '#ffcf00',
  FUCHSIA: '#d946ef',
  BG_BLACK: '#050505',
  BG_CARD: '#0a0a0a',
};

/**
 * Custom node components for the React Flow map.
 */
export const nodeTypes = {
  agent: ({ data }: { data: FlowNodeData }) => (
    <div className="relative group transition-all duration-300 z-10 hover:z-50">
      <div className="px-4 py-3 shadow-[0_0_20px_rgba(0,0,0,0.5)] rounded-md bg-[#0a0a0a] border border-cyber-green/30 min-w-[180px] max-w-[240px] relative overflow-hidden group-hover:border-cyber-green/60 group-hover:shadow-[0_0_25px_rgba(0,255,163,0.15)] transition-all">
        <div className="absolute top-0 right-0 w-16 h-16 bg-cyber-green/5 rounded-full blur-xl -mr-8 -mt-8"></div>
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-sm shrink-0 ${data.enabled ? 'bg-cyber-green/10 text-cyber-green' : 'bg-red-500/10 text-red-500'}`}
          >
            {data.icon}
          </div>
          <div className="overflow-hidden">
            <div
              className={`text-[8px] font-bold uppercase tracking-widest truncate ${data.enabled ? 'text-cyber-green' : 'text-red-500'}`}
            >
              NEURAL_WORKER {!data.enabled && '[OFFLINE]'}
            </div>
            <div className="text-sm font-bold text-foreground break-words leading-tight font-mono uppercase tracking-tighter">
              {data.label}
            </div>
          </div>
        </div>
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-cyber-green/50 !border-none !w-1.5 !h-1.5"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-cyber-green/50 !border-none !w-1.5 !h-1.5"
        />
      </div>

      {/* Description Tooltip Above on Hover */}
      <div className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 w-[220px] bg-[#0f0f0f] border border-cyber-green/30 p-3 rounded shadow-[0_10px_30px_rgba(0,0,0,0.9)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-[100] pointer-events-none backdrop-blur-md">
        <div className="flex items-center gap-2 mb-1.5">
          <Info size={10} className="text-cyber-green" />
          <span className="text-[8px] font-bold text-cyber-green uppercase tracking-[0.2em]">
            Capability_Manifest
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed italic font-mono">
          {data.description}
        </p>
      </div>
    </div>
  ),
  bus: ({ data }: { data: FlowNodeData }) => (
    <div className="relative group transition-all duration-300 z-10 hover:z-50">
      <div className="px-5 py-3 shadow-[0_0_30px_rgba(249,115,22,0.1)] rounded-md bg-[#0a0a0a] border border-orange-500/40 min-w-[240px] text-center relative overflow-hidden group-hover:border-orange-500/80 group-hover:shadow-[0_0_40px_rgba(249,115,22,0.2)] transition-all">
        <div className="absolute inset-0 bg-orange-500/[0.03] animate-pulse"></div>
        <div className="text-[7px] font-bold text-orange-500 uppercase tracking-[0.5em] mb-2 relative z-10 opacity-70">
          Central_Orchestration_Grid
        </div>
        <div className="text-sm font-bold text-foreground flex items-center justify-center gap-2 relative z-10 font-mono uppercase tracking-widest">
          <Zap size={16} className="text-orange-500 animate-pulse" /> {data.label}
        </div>
        <Handle type="target" position={Position.Top} className="!bg-orange-500/50 !border-none" />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="!bg-orange-500/50 !border-none"
        />
        <Handle
          type="source"
          position={Position.Left}
          id="left"
          className="!bg-orange-500/50 !border-none"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!bg-orange-500/50 !border-none"
        />
      </div>

      <div className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 w-[240px] bg-[#0f0f0f] border border-orange-500/30 p-3 rounded shadow-[0_10px_30px_rgba(0,0,0,0.9)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-[100] pointer-events-none text-left backdrop-blur-md">
        <div className="flex items-center gap-2 mb-1.5">
          <Info size={10} className="text-orange-500" />
          <span className="text-[8px] font-bold text-orange-500 uppercase tracking-[0.2em]">
            Neural_Routing_Protocol
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed italic font-mono">
          {data.description}
        </p>
      </div>
    </div>
  ),
  infra: ({ data }: { data: FlowNodeData }) => (
    <div className="relative group transition-all duration-300 z-10 hover:z-50">
      <div className="px-4 py-3 shadow-[0_0_20px_rgba(0,0,0,0.5)] rounded-md bg-[#0a0a0a] border border-cyber-blue/30 min-w-[170px] relative overflow-hidden group-hover:border-cyber-blue/60 group-hover:shadow-[0_0_25px_rgba(0,243,255,0.15)] transition-all">
        <div className="absolute top-0 right-0 w-12 h-12 bg-cyber-blue/5 rounded-full blur-lg -mr-6 -mt-6"></div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyber-blue/10 rounded-sm text-cyber-blue shrink-0">
            {data.icon}
          </div>
          <div className="overflow-hidden">
            <div className="text-[8px] font-bold text-cyber-blue uppercase tracking-widest truncate opacity-70">
              {data.tier === 'APP' ? 'CONSUMER_NODE' : 'INFRA_RESOURCE'}
            </div>
            <div className="text-sm font-bold text-foreground font-mono uppercase tracking-tighter truncate">
              {data.label}
            </div>
          </div>
        </div>
        <Handle type="target" position={Position.Top} className="!bg-cyber-blue/50 !border-none" />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-cyber-blue/50 !border-none"
        />
      </div>

      <div className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 w-[220px] bg-[#0f0f0f] border border-cyber-blue/30 p-3 rounded shadow-[0_10px_30px_rgba(0,0,0,0.9)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-[100] pointer-events-none backdrop-blur-md">
        <div className="flex items-center gap-2 mb-1.5">
          <Info size={10} className="text-cyber-blue" />
          <span className="text-[8px] font-bold text-cyber-blue uppercase tracking-[0.2em]">
            Resource_Telemetry
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed italic font-mono">
          {data.description}
        </p>
      </div>
    </div>
  ),
};

/**
 * Returns an appropriate Lucide icon for an agent based on ID or name.
 */
export const getAgentIcon = (id: string, iconKey?: string): React.ReactNode => {
  if (iconKey && ICON_COMPONENTS[iconKey]) {
    const Icon = ICON_COMPONENTS[iconKey];
    return <Icon size={16} />;
  }

  if (iconKey === 'Bot') return <Bot size={16} />;
  if (iconKey === 'Code') return <Code size={16} />;
  if (iconKey === 'Brain') return <Brain size={16} />;

  const idMap: Record<string, React.ReactNode> = {
    superclaw: <Bot size={16} />,
    coder: <Code size={16} />,
    'strategic-planner': <Brain size={16} />,
    'cognition-reflector': <Search size={16} />,
    monitor: <Activity size={16} />,
    qa: <FlaskConical size={16} />,
  };

  return idMap[id] ?? <Settings2 size={16} />;
};

/**
 * Returns a standardized description for known agents if one isn't provided.
 */
export const getAgentDescription = (id: string): string => {
  const descMap: Record<string, string> = {
    superclaw: 'Processes input, retrieves memory, and orchestrates task delegation to spokes.',
    coder:
      'Specialized engine for heavy lifting: code generation, infra modification, and deployments.',
    'strategic-planner':
      'Intelligence node for analyzing capability gaps and designing long-term evolution.',
    'cognition-reflector': 'Cognitive auditor. Distills facts and lessons from interaction traces.',
    monitor: 'Observability node. Monitors system health and triggers automated fixes on failure.',
    qa: 'Verification auditor. Ensures deployed changes effectively resolve intended requirements.',
  };

  return (
    descMap[id] ??
    'Dynamic neural spoke for specialized task execution and decentralized intelligence.'
  );
};
