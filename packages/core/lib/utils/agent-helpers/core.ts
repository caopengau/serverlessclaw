import { logger } from '../../logger';
import { AgentRole, TraceSource, ReasoningProfile } from '../../types/index';
import {
  AGENT_ERRORS,
  AGENT_ERRORS_CN,
  AGENT_ERROR_PREFIXES,
  LOCALE_INSTRUCTIONS,
} from '../../constants';
import { AgentProcessOptions } from '../../agent/options';

/**
 * Detect if an agent response indicates an internal error.
 */
export function detectFailure(response: string): boolean {
  return (
    response === AGENT_ERRORS.PROCESS_FAILURE ||
    response === AGENT_ERRORS_CN.PROCESS_FAILURE ||
    response.startsWith(AGENT_ERROR_PREFIXES.EN) ||
    response.startsWith(AGENT_ERROR_PREFIXES.CN) ||
    response.startsWith('SYSTEM_ERROR') ||
    response.startsWith('FAILED') ||
    response.startsWith('I encountered an internal error')
  );
}

/**
 * Check if response indicates a paused task.
 */
export function isTaskPaused(response: string): boolean {
  return response.startsWith('TASK_PAUSED');
}

/**
 * Load and validate agent configuration from the registry.
 */
export async function loadAgentConfig(
  agentId: string | AgentRole,
  options?: { workspaceId?: string }
): Promise<import('../../types/index').IAgentConfig> {
  const { AgentRegistry } = await import('../../registry');
  const config = await AgentRegistry.getAgentConfig(agentId, options);

  if (!config) {
    throw new Error(
      `Agent configuration for '${agentId}' not found in Registry${options?.workspaceId ? ` for workspace ${options.workspaceId}` : ''}`
    );
  }

  if (!config.enabled) {
    throw new Error(`Agent '${agentId}' is disabled`);
  }

  if (process.env.MCP_SERVER_ARNS) {
    try {
      const mcpArns = JSON.parse(process.env.MCP_SERVER_ARNS);
      config.mcpServers = {
        ...config.mcpServers,
        ...mcpArns,
      };
    } catch (e) {
      logger.warn(`Failed to parse MCP_SERVER_ARNS for agent ${agentId}:`, e);
    }
  }

  return config;
}

/**
 * Create an Agent instance with tools and configuration.
 */
export async function createAgent(
  agentId: string,
  config: import('../../types/index').IAgentConfig,
  memory: import('../../types/index').IMemory,
  provider: import('../../providers/index').ProviderManager,
  locale: string = 'en'
): Promise<import('../../agent').Agent> {
  const [{ getAgentTools }, { Agent }] = await Promise.all([
    import('../../../tools/index'),
    import('../../agent'),
  ]);
  const agentTools = await getAgentTools(agentId);

  let systemPrompt = config.systemPrompt || '';
  const instruction =
    locale.toLowerCase() === 'cn' ? LOCALE_INSTRUCTIONS.CN : LOCALE_INSTRUCTIONS.EN;
  if (instruction && systemPrompt) {
    systemPrompt += instruction;
  }

  return new Agent(memory, provider, agentTools, { ...config, systemPrompt });
}

/** Options for building process options */
export interface ProcessOptionsParams {
  isContinuation?: boolean;
  isIsolated?: boolean;
  initiatorId?: string;
  depth?: number;
  traceId?: string;
  taskId?: string;
  sessionId?: string;
  workspaceId?: string;
  teamId?: string;
  staffId?: string;
  userRole?: import('../../types/agent').UserRole;
  source?: TraceSource;
  profile?: ReasoningProfile;
  context?: import('aws-lambda').Context;
  responseFormat?: import('../../types/index').ResponseFormat;
  communicationMode?: 'json' | 'text';
  taskTimeoutMs?: number;
  tokenBudget?: number;
  costLimit?: number;
  priorTokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  abortSignal?: AbortSignal;
}

/**
 * Build a common process options object.
 */
export function buildProcessOptions(params: ProcessOptionsParams): AgentProcessOptions {
  return {
    isContinuation: !!params.isContinuation,
    isIsolated: params.isIsolated !== false,
    initiatorId: params.initiatorId || 'orchestrator',
    depth: params.depth || 0,
    traceId: params.traceId,
    taskId: params.taskId,
    sessionId: params.sessionId,
    workspaceId: params.workspaceId,
    teamId: params.teamId,
    staffId: params.staffId,
    userRole: params.userRole,
    source: params.source || TraceSource.SYSTEM,
    profile: params.profile,
    context: params.context,
    responseFormat: params.responseFormat,
    communicationMode: params.communicationMode,
    taskTimeoutMs: params.taskTimeoutMs,
    tokenBudget: params.tokenBudget,
    costLimit: params.costLimit,
    priorTokenUsage: params.priorTokenUsage,
    abortSignal: params.abortSignal,
  };
}
