/**
 * UI-only shared types for dashboard components
 * Keep lightweight to avoid bundling server-only core code into the client.
 */
export interface Tool {
  name: string;
  description: string;
  isExternal?: boolean;
  usage?: {
    count: number;
    lastUsed: number;
  };
}
export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  provider?: string;
  model?: string;
  reasoningProfile?: string;
  enabled: boolean;
  tools: string[];
  isBackbone?: boolean;
  usage?: Record<string, { count: number; lastUsed: number }>;
}

export interface ProviderModel {
  label: string;
  models: string[];
}

export interface TraceStepContent {
  tool?: string;
  toolName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any; // result can be anything (images, objects, strings)
  content?: string;
  tool_calls?: { function: { name: string; arguments: string } }[];
  response?: string;
  messages?: { role: string; content: string }[];
  agentId?: string;
  userText?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface TraceStep {
  stepId: string;
  timestamp: number;
  type: string;
  content: TraceStepContent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

export interface Trace {
  traceId: string;
  userId?: string;
  status: 'completed' | 'started' | 'error';
  timestamp: number;
  source?: string;
  initialContext?: {
    userText?: string;
    sessionId?: string;
    agentId?: string;
    model?: string;
  };
  steps?: TraceStep[];
  finalResponse?: string;
  nodes?: Trace[];
  parentId?: string;
  nodeId: string;
}
