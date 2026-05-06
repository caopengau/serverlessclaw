'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Zap, RefreshCw } from 'lucide-react';

import Button from '@/components/ui/Button';
import Typography from '@/components/ui/Typography';
import Card from '@/components/ui/Card';
import { logger } from '@claw/core/lib/logger';
import {
  FLOW_COLORS,
  nodeTypes,
  getAgentIcon,
  getAgentDescription,
  type BlueprintNode,
  type BlueprintEdge,
  type BlueprintTopology,
} from './FlowParts';

/**
 * Main logical content of the topology flow.
 */
export function FlowContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const fetchTopology = useCallback(async () => {
    try {
      const response = await fetch('/api/topology');
      if (!response.ok) throw new Error('Failed to fetch topology');
      const data: BlueprintTopology = await response.json();

      const newNodes: Node[] = data.nodes.map((n: BlueprintNode, i: number) => ({
        id: n.id,
        type: n.type === 'agent' ? 'agent' : n.type === 'bus' ? 'bus' : 'infra',
        position: { x: (i % 3) * 300, y: Math.floor(i / 3) * 200 },
        data: {
          label: n.label,
          description: n.description || getAgentDescription(n.id),
          icon: getAgentIcon(n.id, n.icon),
          enabled: n.enabled !== false,
          type: n.type,
        },
      }));

      const newEdges: Edge[] = data.edges.map((e: BlueprintEdge) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: true,
        style: { stroke: FLOW_COLORS.CYBER_BLUE, strokeWidth: 2 },
      }));

      setNodes(newNodes);
      setEdges(newEdges);
      setLoading(false);
    } catch (err) {
      logger.error('[Topology] Fetch error:', err);
      setLoading(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    const init = async () => {
      await fetchTopology();
    };
    init();
  }, [fetchTopology]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#020202]">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <Typography
          variant="mono"
          className="text-[10px] text-cyber-blue font-bold tracking-[0.4em] uppercase"
          glow
        >
          Neural_System_Spine
        </Typography>
      </div>

      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        <Card variant="glass" padding="none" className="p-1 flex flex-col gap-1 border-white/5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => zoomIn()}
            className="!p-1.5 h-8 w-8 hover:bg-white/5"
            icon={<Plus size={14} className="text-cyber-blue" />}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => zoomOut()}
            className="!p-1.5 h-8 w-8 hover:bg-white/5"
            icon={<Minus size={14} className="text-cyber-blue" />}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLoading(true);
              fetchTopology();
              setTimeout(() => fitView(), 100);
            }}
            title="Reset View & Layout"
            className="!p-1.5 h-8 w-8 border-t border-white/5 !rounded-none hover:bg-white/5"
            icon={<Maximize size={14} className="text-cyber-blue" />}
          />
        </Card>
      </div>

      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLoading(true);
            fetchTopology();
          }}
          className="bg-black/60 border-cyber-blue/30 text-cyber-blue hover:bg-cyber-blue/10 backdrop-blur-md"
          icon={<RefreshCw size={12} className={loading ? 'animate-spin' : ''} />}
        >
          SYNC_TOPOLOGY
        </Button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        className="bg-dot-pattern"
      >
        <Background color="#111" gap={20} />
      </ReactFlow>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-30 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Zap size={32} className="text-cyber-blue animate-pulse" />
            <Typography
              variant="mono"
              className="text-[10px] text-cyber-blue tracking-widest uppercase"
            >
              Initializing_Neural_Grid...
            </Typography>
          </div>
        </div>
      )}
    </div>
  );
}

function Plus({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );
}

function Minus({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );
}

function Maximize({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3"></path>
      <path d="M21 8V5a2 2 0 0 0-2-2h-3"></path>
      <path d="M3 16v3a2 2 0 0 0 2 2h3"></path>
      <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>
    </svg>
  );
}

/**
 * Higher-level wrapper ensuring React Flow context is available.
 */
export default function SystemPulseFlow() {
  return (
    <ReactFlowProvider>
      <FlowContent />
    </ReactFlowProvider>
  );
}
