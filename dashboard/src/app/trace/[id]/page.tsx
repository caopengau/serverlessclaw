import React from 'react';
import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { 
  ArrowLeft, 
  Clock, 
  Activity, 
  MessageSquare, 
  Wrench, 
  CheckCircle, 
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Bot,
  Zap
} from 'lucide-react';
import Link from 'next/link';
import PathVisualizer from '@/components/PathVisualizer';
import { UI_STRINGS, TRACE_TYPES, TRACE_STATUS } from '@/lib/constants';
import { SSTResource } from '@claw/core/lib/types/index';

export const dynamic = 'force-dynamic';

/**
 * Interface representing a trace record and its nested steps
 */
interface TraceStep {
  stepId: string;
  type: string;
  timestamp: number;
  content: any; // Raw payload from DynamoDB
}

interface TraceNode {
  traceId: string;
  nodeId: string;
  parentId?: string;
  timestamp: number;
  userId: string;
  source: string;
  status: string;
  initialContext?: {
    userText: string;
    agentId?: string;
  };
  steps?: TraceStep[];
  finalResponse?: string;
}

/**
 * Fetches all nodes for a specific trace record from DynamoDB
 */
async function getTraceNodes(traceId: string): Promise<TraceNode[]> {
  try {
    const typedResource = Resource as unknown as SSTResource;
    const tableName = typedResource.TraceTable?.name;
    if (!tableName) {
      console.error('TraceTable name is missing from Resources');
      return [];
    }
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });
    
    const { Items } = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'traceId = :tid',
        ExpressionAttributeValues: { ':tid': traceId },
      })
    );
    
    return (Items as TraceNode[]) || [];
  } catch (e) {
    console.error('Error fetching trace nodes:', e);
    return [];
  }
}

/**
 * Returns the appropriate icon for a trace step type
 */
function StepIcon({ type }: { type: string }): React.ReactElement {
  switch (type) {
    case TRACE_TYPES.LLM_CALL:
      return <MessageSquare size={16} className="text-purple-400" />;
    case TRACE_TYPES.LLM_RESPONSE:
      return <Zap size={16} className="text-cyber-green" />;
    case TRACE_TYPES.TOOL_CALL:
      return <Wrench size={16} className="text-yellow-400" />;
    case TRACE_TYPES.TOOL_RESULT:
      return <CheckCircle size={16} className="text-cyber-green" />;
    case TRACE_TYPES.ERROR:
      return <ShieldAlert size={16} className="text-red-500" />;
    default:
      return <Activity size={16} className="text-white/100" />;
  }
}

/**
 * Detailed view of a single execution trace
 */
export default async function TraceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const nodes = await getTraceNodes(id);

  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] text-white/100">
        <ShieldAlert size={48} className="mb-4 opacity-20" />
        <h1 className="text-xl font-bold">{UI_STRINGS.TRACE_NOT_FOUND}</h1>
        <Link href="/trace" className="mt-4 text-cyber-green hover:underline flex items-center gap-2">
          <ArrowLeft size={16} /> {UI_STRINGS.RETURN_TO_BASE}
        </Link>
      </div>
    );
  }

  // Use the root node (usually the first one or one with nodeId='root') for header info
  const rootNode = nodes.find(n => n.nodeId === 'root') || nodes[0];

  return (
    <div className="flex-1 overflow-y-auto p-10 space-y-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyber-blue/5 via-transparent to-transparent">
      <header className="mb-10">
        <Link href="/trace" className="text-white/100 hover:text-cyber-green transition-colors flex items-center gap-2 text-xs mb-6 group">
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> {UI_STRINGS.BACK_TO_INTELLIGENCE}
        </Link>
        
        <div className="flex justify-between items-end border-b border-white/5 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold ${
                rootNode.status === TRACE_STATUS.COMPLETED ? 'bg-cyber-green/20 text-cyber-green' : 'bg-yellow-500/20 text-yellow-500'
              }`}>
                {rootNode.status.toUpperCase()}
              </span>
              <h1 className="text-2xl font-bold tracking-tighter">TRACE::{rootNode.traceId.slice(0, 8)}</h1>
            </div>
            <p className="text-white/100 text-sm max-w-2xl">
              {rootNode.initialContext?.userText || 'System orchestrated task execution.'}
            </p>
          </div>
          
          <div className="text-right text-[12px] text-white/90 space-y-1">
            <div className="flex items-center justify-end gap-2">
              <Clock size={12} /> {new Date(rootNode.timestamp).toLocaleString()}
            </div>
            <div>SOURCE: <span className="text-cyber-blue uppercase font-bold">{rootNode.source || 'UNKNOWN'}</span></div>
            <div>USER_ID: {rootNode.userId}</div>
            <div className="flex items-center justify-end gap-2">
              NODES: <span className="text-cyber-green font-bold">{nodes.length}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="space-y-12">
        {/* Visualizer Section */}
        <section>
          <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/100 flex items-center gap-2 mb-4">
            <LayoutGrid size={14} className="text-cyber-green" /> {UI_STRINGS.NEURAL_PATH_VISUALIZER}
          </h2>
          {/* PathVisualizer will now receive all nodes to render the graph */}
          <PathVisualizer trace={{ ...rootNode, nodes }} />
        </section>

        {nodes.sort((a, b) => a.timestamp - b.timestamp).map((node) => (
          <section key={node.nodeId} className="space-y-6">
            <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/100 flex items-center gap-2 mb-4">
              <Activity size={14} className="text-cyber-green" /> NODE::{node.nodeId} {node.parentId ? `(Parent: ${node.parentId.slice(0,8)})` : '(ROOT)'}
            </h2>

            <div className="space-y-4">
              {node.steps?.map((step: TraceStep, idx: number) => (
                <div key={step.stepId} className="glass-card border-white/5 overflow-hidden">
                  <div className="p-4 flex items-center justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                        <StepIcon type={step.type} />
                      </div>
                      <div>
                        <div className="text-[10px] text-white/100 font-bold uppercase tracking-wider">{step.type}</div>
                        <div className="text-sm font-medium">
                          {step.type === TRACE_TYPES.TOOL_CALL ? `Executing ${step.content.tool || step.content.toolName || ''}` : 
                           step.type === TRACE_TYPES.TOOL_RESULT ? `Observation from ${step.content.tool || step.content.toolName || 'tool'}` :
                           step.type === TRACE_TYPES.LLM_CALL ? 'Neural Core Synthesis (Input)' : 
                           step.type === TRACE_TYPES.LLM_RESPONSE ? 'Neural Core Generation (Output)' : 'Error detected'}
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-white/50">
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  
                  <div className="p-4 bg-black/40 border-t border-white/5">
                    {step.type === TRACE_TYPES.TOOL_RESULT && step.content.result && typeof step.content.result === 'object' && step.content.result.images && (
                      <div className="mb-4 space-y-4">
                        <div className="text-[10px] text-cyber-blue/60 uppercase font-bold tracking-widest flex items-center gap-2">
                           <LayoutGrid size={12} /> Generated_Visuals
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {step.content.result.images.map((img: string, imgIdx: number) => (
                            <div key={imgIdx} className="border border-white/10 rounded overflow-hidden bg-black/20 group/img relative">
                              <img 
                                src={img.startsWith('data:') ? img : `data:image/png;base64,${img}`} 
                                alt={`Output ${imgIdx}`}
                                className="w-full h-auto object-contain max-h-[400px]"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {step.type === 'llm_response' && step.content.content ? (
                      <div className="mb-4 p-4 bg-cyber-green/[0.03] border border-cyber-green/10 rounded">
                        <div className="text-[10px] text-cyber-green/60 uppercase font-bold mb-2 tracking-widest flex items-center gap-2">
                           <Bot size={12} /> Generated_Response
                        </div>
                        <div className="text-xs text-white/90 leading-relaxed whitespace-pre-wrap font-mono">
                          {step.content.content}
                        </div>
                        {step.content.tool_calls && step.content.tool_calls.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-cyber-green/10">
                             <div className="text-[10px] text-yellow-500/60 uppercase font-bold mb-2 tracking-widest">
                               Requested_Tools
                             </div>
                             <div className="space-y-2">
                               {step.content.tool_calls.map((tc: any, tci: number) => (
                                 <div key={tci} className="text-[10px] bg-yellow-500/5 border border-yellow-500/10 p-2 rounded font-mono text-yellow-500/80">
                                   {tc.function.name}({tc.function.arguments})
                                 </div>
                               ))}
                             </div>
                          </div>
                        )}
                      </div>
                    ) : null}

                    <details className="group">
                      <summary className="list-none cursor-pointer flex items-center justify-between text-[10px] text-cyber-green/60 hover:text-cyber-green transition-colors">
                        <span className="flex items-center gap-1 uppercase tracking-widest font-bold">
                          {UI_STRINGS.RAW_PAYLOAD}
                        </span>
                        <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
                      </summary>
                      <div className="mt-4 p-4 bg-black/60 rounded border border-white/5 overflow-x-auto">
                        <pre className="text-[11px] leading-relaxed text-cyber-blue/80">
                          {JSON.stringify(step.content, null, 2)}
                        </pre>
                      </div>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {rootNode.finalResponse && (
          <section className="mt-12">
            <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/100 flex items-center gap-2 mb-4">
              <CheckCircle size={14} className="text-cyber-green" /> {UI_STRINGS.FINAL_OUTPUT}
            </h2>
            <div className="glass-card p-6 border-cyber-green/20 bg-cyber-green/[0.02]">
              <div className="prose prose-invert max-w-none text-sm leading-relaxed text-white/90">
                {rootNode.finalResponse}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
