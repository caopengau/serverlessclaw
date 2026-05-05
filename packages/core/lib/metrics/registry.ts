import { MetricDatum } from './types';

function getDimensions(scope?: {
  workspaceId?: string;
  teamId?: string;
  staffId?: string;
  orgId?: string;
}) {
  const dimensions: Array<{ Name: string; Value: string }> = [];
  if (!scope) return dimensions;

  if (scope.workspaceId) dimensions.push({ Name: 'WorkspaceId', Value: scope.workspaceId });
  if (scope.teamId) dimensions.push({ Name: 'TeamId', Value: scope.teamId });
  if (scope.staffId) dimensions.push({ Name: 'StaffId', Value: scope.staffId });
  if (scope.orgId) dimensions.push({ Name: 'OrgId', Value: scope.orgId });
  return dimensions;
}

export const METRICS = {
  agentInvoked(
    agentId: string,
    success: boolean = true,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'AgentInvocations',
      Value: 1,
      Unit: 'Count',
      Dimensions: [
        { Name: 'AgentId', Value: agentId },
        { Name: 'Success', Value: String(success) },
        ...getDimensions(scope),
      ],
    };
  },

  agentDuration(
    agentId: string,
    durationMs: number,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'AgentDuration',
      Value: durationMs,
      Unit: 'Milliseconds',
      Dimensions: [{ Name: 'AgentId', Value: agentId }, ...getDimensions(scope)],
    };
  },

  toolExecuted(
    toolName: string,
    success: boolean,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'ToolExecutions',
      Value: 1,
      Unit: 'Count',
      Dimensions: [
        { Name: 'ToolName', Value: toolName },
        { Name: 'Success', Value: String(success) },
        ...getDimensions(scope),
      ],
    };
  },

  toolDuration(
    toolName: string,
    durationMs: number,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'ToolDuration',
      Value: durationMs,
      Unit: 'Milliseconds',
      Dimensions: [{ Name: 'ToolName', Value: toolName }, ...getDimensions(scope)],
    };
  },

  taskDispatchLatency(
    latencyMs: number,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'TaskDispatchLatency',
      Value: latencyMs,
      Unit: 'Milliseconds',
      Dimensions: getDimensions(scope),
    };
  },

  circuitBreakerTriggered(
    type: 'deploy' | 'recovery' | 'gap' | 'event',
    scope?: { workspaceId?: string; teamId?: string; staffId?: string },
    eventType?: string
  ): MetricDatum {
    const dimensions = [{ Name: 'Type', Value: type }, ...getDimensions(scope)];
    if (eventType) dimensions.push({ Name: 'EventType', Value: eventType });

    return {
      MetricName: 'CircuitBreakerTriggered',
      Value: 1,
      Unit: 'Count',
      Dimensions: dimensions,
    };
  },

  rateLimitExceeded(
    eventType: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'RateLimitExceeded',
      Value: 1,
      Unit: 'Count',
      Dimensions: [{ Name: 'EventType', Value: eventType }, ...getDimensions(scope)],
    };
  },

  mcpHubPing(opts: {
    success: boolean;
    latencyMs?: number;
    scope?: { workspaceId?: string; teamId?: string; staffId?: string };
  }): MetricDatum {
    return {
      MetricName: 'MCPHubPing',
      Value: opts.success ? 1 : 0,
      Unit: 'Count',
      Dimensions: [{ Name: 'Success', Value: String(opts.success) }, ...getDimensions(opts.scope)],
    };
  },

  mcpHubLatency(
    latencyMs: number,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'MCPHubLatency',
      Value: latencyMs,
      Unit: 'Milliseconds',
      Dimensions: getDimensions(scope),
    };
  },

  eventBridgeEmit(
    success: boolean,
    latencyMs: number,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'EventBridgeEmit',
      Value: latencyMs,
      Unit: 'Milliseconds',
      Dimensions: [{ Name: 'Success', Value: String(success) }, ...getDimensions(scope)],
    };
  },

  dlqEvents(
    count: number,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'DLQEvents',
      Value: count,
      Unit: 'Count',
      Dimensions: getDimensions(scope),
    };
  },

  lockAcquired(
    lockId: string,
    success: boolean,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'LockAcquisition',
      Value: success ? 1 : 0,
      Unit: 'Count',
      Dimensions: [
        { Name: 'LockId', Value: lockId },
        { Name: 'Success', Value: String(success) },
        ...getDimensions(scope),
      ],
    };
  },

  deploymentStarted(scope?: {
    workspaceId?: string;
    teamId?: string;
    staffId?: string;
  }): MetricDatum {
    return {
      MetricName: 'DeploymentStarted',
      Value: 1,
      Unit: 'Count',
      Dimensions: getDimensions(scope),
    };
  },

  deploymentCompleted(opts: {
    success: boolean;
    scope?: { workspaceId?: string; teamId?: string; staffId?: string };
  }): MetricDatum {
    return {
      MetricName: 'DeploymentCompleted',
      Value: 1,
      Unit: 'Count',
      Dimensions: [{ Name: 'Success', Value: String(opts.success) }, ...getDimensions(opts.scope)],
    };
  },

  tokensInput(
    inputTokens: number,
    agentId: string,
    provider: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'TokensInput',
      Value: inputTokens,
      Unit: 'Count',
      Dimensions: [
        { Name: 'AgentId', Value: agentId },
        { Name: 'Provider', Value: provider },
        ...getDimensions(scope),
      ],
    };
  },

  tokensOutput(
    outputTokens: number,
    agentId: string,
    provider: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'TokensOutput',
      Value: outputTokens,
      Unit: 'Count',
      Dimensions: [
        { Name: 'AgentId', Value: agentId },
        { Name: 'Provider', Value: provider },
        ...getDimensions(scope),
      ],
    };
  },

  protocolFallback(
    agentId: string,
    originalMode: string,
    fallbackMode?: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'ProtocolFallback',
      Value: 1,
      Unit: 'Count',
      Dimensions: [
        { Name: 'AgentId', Value: agentId },
        { Name: 'OriginalMode', Value: originalMode },
        { Name: 'FallbackMode', Value: fallbackMode || 'none' },
        ...getDimensions(scope),
      ],
    };
  },

  eventHandlerInvoked(
    eventType: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'EventHandlerInvoked',
      Value: 1,
      Unit: 'Count',
      Dimensions: [{ Name: 'EventType', Value: eventType }, ...getDimensions(scope)],
    };
  },

  eventHandlerDuration(
    eventType: string,
    durationMs: number,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'EventHandlerDuration',
      Value: durationMs,
      Unit: 'Milliseconds',
      Dimensions: [{ Name: 'EventType', Value: eventType }, ...getDimensions(scope)],
    };
  },

  eventHandlerErrorDuration(
    eventType: string,
    durationMs: number,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'EventHandlerErrorDuration',
      Value: durationMs,
      Unit: 'Milliseconds',
      Dimensions: [{ Name: 'EventType', Value: eventType }, ...getDimensions(scope)],
    };
  },

  swarmDecomposed(
    agentId: string,
    subTaskCount: number,
    depth: number,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'SwarmDecomposed',
      Value: subTaskCount,
      Unit: 'Count',
      Dimensions: [
        { Name: 'AgentId', Value: agentId },
        { Name: 'Depth', Value: String(depth) },
        ...getDimensions(scope),
      ],
    };
  },

  parallelDispatchCompleted(
    traceId: string,
    taskCount: number,
    successCount: number,
    overallStatus: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'ParallelDispatchCompleted',
      Value: successCount,
      Unit: 'Count',
      Dimensions: [
        { Name: 'TraceId', Value: traceId },
        { Name: 'OverallStatus', Value: overallStatus },
        ...getDimensions(scope),
      ],
    };
  },

  storageError(
    operation: string,
    errorName: string,
    tableName: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): MetricDatum {
    return {
      MetricName: 'StorageError',
      Value: 1,
      Unit: 'Count',
      Dimensions: [
        { Name: 'Operation', Value: operation },
        { Name: 'ErrorName', Value: errorName },
        { Name: 'TableName', Value: tableName },
        ...getDimensions(scope),
      ],
    };
  },

  configAccessed(
    key: string,
    operation: 'get' | 'set' | 'delete' | 'increment',
    scope?: { workspaceId?: string; orgId?: string }
  ): MetricDatum {
    return {
      MetricName: 'ConfigAccess',
      Value: 1,
      Unit: 'Count',
      Dimensions: [
        { Name: 'Key', Value: key },
        { Name: 'Operation', Value: operation },
        ...getDimensions(scope),
      ],
    };
  },
};
