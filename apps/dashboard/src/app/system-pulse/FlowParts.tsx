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
import { THEME } from '@/lib/theme';

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
      <div className="px-4 py-3 shadow-lg rounded-md bg-background border border-cyber-green/50 min-w-[180px] max-w-[240px] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 bg-cyber-green/5 rounded-full blur-xl -mr-8 -mt-8"></div>
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-sm shrink-0 ${data.enabled ? 'bg-cyber-green/10 text-cyber-green' : 'bg-red-500/10 text-red-500'}`}
          >
            {data.icon}
          </div>
          <div className="overflow-hidden">
            <div
              className={`text-[10px] font-bold uppercase tracking-tighter truncate ${data.enabled ? 'text-cyber-green' : 'text-red-500'}`}
            >
              {data.type ?? 'NEURAL_NODE'} {!data.enabled && '[OFFLINE]'}
            </div>
            <div className="text-sm font-bold text-foreground break-words leading-tight">
              {data.label}
            </div>
          </div>
        </div>
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-cyber-green/50 !border-none !w-2 !h-2"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-cyber-green/50 !border-none !w-2 !h-2"
        />
      </div>

      {/* Description Tooltip Above on Hover */}
      <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-[220px] bg-card-elevated border border-cyber-green/30 p-3 rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.8)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-[100] pointer-events-none after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent after:border-t-[var(--card-bg-elevated)]">
        <div className="flex items-center gap-2 mb-1">
          <Info size={10} className="text-cyber-green" />
          <span className="text-[8px] font-bold text-cyber-green uppercase tracking-widest">
            Documentation
          </span>
        </div>
        <p className="text-[10px] text-foreground leading-relaxed italic">{data.description}</p>
      </div>
    </div>
  ),
  bus: ({ data }: { data: FlowNodeData }) => (
    <div className="relative group transition-all duration-300 z-10 hover:z-50">
      <div className="px-4 py-2 shadow-lg rounded-md bg-background border border-orange-500/50 min-w-[220px] text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-orange-500/5 animate-pulse"></div>
        <div className="text-[8px] font-bold text-orange-500 uppercase tracking-[0.3em] mb-1 relative z-10">
          Central_Orchestrator
        </div>
        <div className="text-xs font-bold text-foreground flex items-center justify-center gap-2 relative z-10">
          <Zap size={14} className="text-orange-500" /> {data.label}
        </div>
        <Handle type="target" position={Position.Top} className="!bg-orange-500/50" />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="!bg-orange-500/50"
        />
        <Handle type="source" position={Position.Left} id="left" className="!bg-orange-500/50" />
        <Handle type="source" position={Position.Right} id="right" className="!bg-orange-500/50" />
      </div>

      {/* Description Tooltip Above on Hover */}
      <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-[240px] bg-card-elevated border border-orange-500/30 p-3 rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.8)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-[100] pointer-events-none text-left after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent after:border-t-[var(--card-bg-elevated)]">
        <div className="flex items-center gap-2 mb-1">
          <Info size={10} className="text-orange-500" />
          <span className="text-[8px] font-bold text-orange-500 uppercase tracking-widest">
            Protocol_Info
          </span>
        </div>
        <p className="text-[10px] text-foreground leading-relaxed italic">{data.description}</p>
      </div>
    </div>
  ),
  infra: ({ data }: { data: FlowNodeData }) => (
    <div className="relative group transition-all duration-300 z-10 hover:z-50">
      <div
        className={`px-4 py-2 shadow-lg rounded-md bg-background border border-${THEME.COLORS.INTEL}/30 min-w-[150px] relative overflow-hidden`}
      >
        <div
          className={`absolute top-0 right-0 w-12 h-12 bg-${THEME.COLORS.INTEL}/5 rounded-full blur-lg -mr-6 -mt-6`}
        ></div>
        <div className="flex items-center gap-3">
          <div className={`p-2 bg-${THEME.COLORS.INTEL}/10 rounded-sm text-${THEME.COLORS.INTEL}`}>
            {data.icon}
          </div>
          <div>
            <div
              className={`text-[10px] font-bold text-${THEME.COLORS.INTEL} uppercase tracking-tighter`}
            >
              {data.type ?? 'INFRA_SPOKE'}
            </div>
            <div className="text-sm font-bold text-foreground">{data.label}</div>
          </div>
        </div>
        <Handle type="target" position={Position.Top} className={`!bg-${THEME.COLORS.INTEL}/50`} />
        <Handle
          type="source"
          position={Position.Bottom}
          className={`!bg-${THEME.COLORS.INTEL}/50`}
        />
      </div>

      {/* Description Tooltip Above on Hover */}
      <div
        className={`absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-[220px] bg-card-elevated border border-${THEME.COLORS.INTEL}/30 p-3 rounded-md shadow-[0_10px_30px_rgba(0,0,0,0.8)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-[100] pointer-events-none after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent after:border-t-[var(--card-bg-elevated)]`}
      >
        <div className="flex items-center gap-2 mb-1">
          <Info size={10} className={`text-${THEME.COLORS.INTEL}`} />
          <span
            className={`text-[8px] font-bold text-${THEME.COLORS.INTEL} uppercase tracking-widest`}
          >
            Resource_Spec
          </span>
        </div>
        <p className="text-[10px] text-foreground leading-relaxed italic">{data.description}</p>
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
