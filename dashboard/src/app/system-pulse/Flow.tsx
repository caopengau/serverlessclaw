'use client';

import React from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  Node,
  Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bot, Zap, Code, ShieldCheck, Terminal, Cpu } from 'lucide-react';

const nodeTypes = {
  agent: ({ data }: any) => (
    <div className="px-4 py-2 shadow-lg rounded-md bg-black border border-cyber-green/50 min-w-[150px] relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-16 h-16 bg-cyber-green/5 rounded-full blur-xl -mr-8 -mt-8"></div>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-cyber-green/10 rounded-sm text-cyber-green">
          {data.icon}
        </div>
        <div>
          <div className="text-[10px] font-bold text-cyber-green uppercase tracking-tighter">
            {data.type}
          </div>
          <div className="text-sm font-bold text-white/90">{data.label}</div>
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="!bg-cyber-green/50 !border-none !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-cyber-green/50 !border-none !w-2 !h-2" />
    </div>
  ),
  bus: ({ data }: any) => (
    <div className="px-4 py-2 shadow-lg rounded-md bg-black border border-orange-500/50 min-w-[200px] text-center cyber-border-orange relative">
        <div className="text-[8px] font-bold text-orange-500 uppercase tracking-[0.3em] mb-1">Central_Orchestrator</div>
        <div className="text-xs font-bold text-white flex items-center justify-center gap-2">
            <Zap size={14} className="text-orange-500" /> {data.label}
        </div>
        <Handle type="target" position={Position.Top} className="!bg-orange-500/50" />
        <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-orange-500/50" />
        <Handle type="source" position={Position.Left} id="left" className="!bg-orange-500/50" />
        <Handle type="source" position={Position.Right} id="right" className="!bg-orange-500/50" />
    </div>
  ),
  infra: ({ data }: any) => (
    <div className="px-4 py-2 shadow-lg rounded-md bg-black border border-cyber-blue/30 min-w-[150px]">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-cyber-blue/10 rounded-sm text-cyber-blue">
          {data.icon}
        </div>
        <div>
          <div className="text-[10px] font-bold text-cyber-blue uppercase tracking-tighter">
            INFRA_SPOKE
          </div>
          <div className="text-sm font-bold text-white/90">{data.label}</div>
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="!bg-cyber-blue/50" />
    </div>
  ),
};

const initialNodes: Node[] = [
  {
    id: 'main',
    type: 'agent',
    position: { x: 250, y: 0 },
    data: { label: 'Main Manager', type: 'Logic_Core', icon: <Bot size={16} /> },
  },
  {
    id: 'bus',
    type: 'bus',
    position: { x: 200, y: 120 },
    data: { label: 'EventBridge AgentBus' },
  },
  {
    id: 'coder',
    type: 'agent',
    position: { x: 50, y: 250 },
    data: { label: 'Coder Agent', type: 'Worker_Spoke', icon: <Code size={16} /> },
  },
  {
    id: 'monitor',
    type: 'agent',
    position: { x: 450, y: 250 },
    data: { label: 'Build Monitor', type: 'Observatory', icon: <ShieldCheck size={16} /> },
  },
  {
    id: 'codebuild',
    type: 'infra',
    position: { x: 450, y: 400 },
    data: { label: 'AWS CodeBuild', icon: <Terminal size={16} /> },
  },
  {
    id: 's3',
    type: 'infra',
    position: { x: 50, y: 400 },
    data: { label: 'Staging Bucket', icon: <Cpu size={16} /> },
  },
];

const initialEdges: Edge[] = [
  { 
    id: 'main-bus', 
    source: 'main', 
    target: 'bus', 
    animated: true, 
    label: 'DISPATCH',
    labelStyle: { fill: '#fff', fontSize: 10, fontWeight: 'bold' },
    style: { stroke: '#00ff91', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#00ff91' }
  },
  { 
    id: 'bus-coder', 
    source: 'bus', 
    target: 'coder', 
    sourceHandle: 'left',
    animated: true,
    style: { stroke: '#f97316' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } 
  },
  { 
    id: 'bus-monitor', 
    source: 'bus', 
    target: 'monitor', 
    sourceHandle: 'right',
    animated: true,
    style: { stroke: '#f97316' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } 
  },
  { 
    id: 'monitor-codebuild', 
    source: 'monitor', 
    target: 'codebuild', 
    style: { stroke: '#00f3ff', strokeDasharray: '5,5' },
    label: 'OBSERVE',
    labelStyle: { fill: '#00f3ff', fontSize: 8 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#00f3ff' } 
  },
  { 
    id: 'coder-s3', 
    source: 'coder', 
    target: 's3', 
    style: { stroke: '#00f3ff', strokeDasharray: '5,5' },
    label: 'STAGE',
    labelStyle: { fill: '#00f3ff', fontSize: 8 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#00f3ff' } 
  },
];

export default function SystemPulseFlow() {
  return (
    <div className="h-[600px] w-full bg-[#050505] rounded-lg border border-white/5 relative">
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        nodeTypes={nodeTypes}
        fitView
        className="bg-dot-pattern"
      >
        <Background color="#333" gap={20} />
        <Controls />
      </ReactFlow>
      
      <div className="absolute top-4 left-4 z-10 space-y-2 pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1 bg-black/80 border border-cyber-green/30 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-green opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber-green"></span>
              </span>
              <span className="text-[10px] font-bold text-cyber-green uppercase">Logic_Core_Online</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-black/80 border border-orange-500/30 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              <span className="text-[10px] font-bold text-orange-500 uppercase">AgentBus_Active</span>
          </div>
      </div>
    </div>
  );
}
