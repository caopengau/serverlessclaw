import {
  SharedContext,
  AGENT_CONFIG,
  LAMBDA_ARCHITECTURE,
  NODEJS_LOADERS,
  LOG_RETENTION_PERIOD,
} from '../shared';
import { createSchedulerRole, createScheduledInvocation } from './scheduler-utils';

interface MaintenanceOptions {
  prefix: string;
  liveInLocalOnly: boolean | undefined;
  baseLink: any[];
  basePermissions: any[];
  agentEnv: Record<string, any>;
  recoveryScheduleRate: string;
}

export function createMaintenanceHandlers(ctx: SharedContext, options: MaintenanceOptions) {
  const { memoryTable, traceTable, bus, deployer, deployerLink, api } = ctx;
  const { prefix, liveInLocalOnly, baseLink, basePermissions, agentEnv, recoveryScheduleRate } =
    options;

  const heartbeatHandler = new sst.aws.Function('HeartbeatHandler', {
    handler: `${prefix}packages/core/handlers/heartbeat.handler`,
    dev: liveInLocalOnly as any,
    link: baseLink,
    permissions: basePermissions,
    architecture: LAMBDA_ARCHITECTURE,
    nodejs: { loader: NODEJS_LOADERS },
    memory: AGENT_CONFIG.memory.SMALL,
    timeout: AGENT_CONFIG.timeout.SHORT,
    logging: {
      retention: LOG_RETENTION_PERIOD,
    },
  });

  const schedulerRole = createSchedulerRole('Dynamic', heartbeatHandler.arn);

  const deadMansSwitch = new sst.aws.Function('DeadMansSwitch', {
    handler: `${prefix}packages/core/handlers/recovery.handler`,
    dev: liveInLocalOnly as any,
    link: [...baseLink, deployerLink, api!],
    permissions: [
      ...basePermissions,
      {
        actions: ['codebuild:StartBuild'],
        resources: [deployer.arn],
      },
    ],
    environment: {
      ...agentEnv,
      STAGE: $app.stage,
    },
    architecture: LAMBDA_ARCHITECTURE,
    nodejs: { loader: NODEJS_LOADERS },
    memory: AGENT_CONFIG.memory.SMALL,
    timeout: AGENT_CONFIG.timeout.MEDIUM,
    logging: {
      retention: LOG_RETENTION_PERIOD,
    },
  });

  new aws.scheduler.Schedule('RecoverySchedule', {
    name: `${$app.name}-${$app.stage}-Recovery`,
    description: "Dead man's switch — deep health checks and emergency rollback",
    scheduleExpression: recoveryScheduleRate,
    state: 'DISABLED',
    flexibleTimeWindow: { mode: 'OFF' },
    target: {
      arn: deadMansSwitch.arn,
      roleArn: createSchedulerRole('Recovery', deadMansSwitch.arn).arn,
    },
  });

  new aws.lambda.Permission('RecoveryPermission', {
    action: 'lambda:InvokeFunction',
    function: deadMansSwitch.name,
    principal: 'scheduler.amazonaws.com',
  });

  const maintenanceHandler = new sst.aws.Function('MaintenanceHandler', {
    handler: `${prefix}packages/core/handlers/maintenance.handler`,
    dev: liveInLocalOnly as any,
    link: [memoryTable, bus],
    permissions: basePermissions,
    architecture: LAMBDA_ARCHITECTURE,
    nodejs: { loader: NODEJS_LOADERS },
    memory: AGENT_CONFIG.memory.SMALL,
    timeout: AGENT_CONFIG.timeout.MEDIUM,
    logging: {
      retention: LOG_RETENTION_PERIOD,
    },
  });

  const traceCleanupHandler = new sst.aws.Function('TraceCleanupHandler', {
    handler: `${prefix}packages/core/handlers/trace-cleanup.handler`,
    dev: liveInLocalOnly as any,
    link: [traceTable],
    permissions: basePermissions,
    architecture: LAMBDA_ARCHITECTURE,
    nodejs: { loader: NODEJS_LOADERS },
    memory: AGENT_CONFIG.memory.SMALL,
    timeout: AGENT_CONFIG.timeout.MEDIUM,
    logging: {
      retention: LOG_RETENTION_PERIOD,
    },
  });

  const mcpWarmupHandler = new sst.aws.Function('MCPWarmupHandler', {
    handler: `${prefix}packages/core/handlers/mcp-warmup.handler`,
    dev: liveInLocalOnly as any,
    link: baseLink,
    permissions: basePermissions,
    architecture: LAMBDA_ARCHITECTURE,
    nodejs: { loader: NODEJS_LOADERS },
    environment: agentEnv,
    memory: AGENT_CONFIG.memory.SMALL,
    timeout: AGENT_CONFIG.timeout.MEDIUM,
    logging: {
      retention: LOG_RETENTION_PERIOD,
    },
  });

  return {
    heartbeatHandler,
    schedulerRole,
    deadMansSwitch,
    maintenanceHandler,
    traceCleanupHandler,
    mcpWarmupHandler,
  };
}

export function setupMaintenanceSchedules(
  handlers: ReturnType<typeof createMaintenanceHandlers>,
  eventHandler: sst.aws.Function,
  concurrencyMonitor: sst.aws.Function,
  concurrencyMonitorRate: string
) {
  const { maintenanceHandler, traceCleanupHandler, mcpWarmupHandler } = handlers;

  createScheduledInvocation(
    'Maintenance',
    'rate(12 hours)',
    maintenanceHandler,
    'Triggers proactive evolution, tie-breaks, and stale gap archival'
  );

  createScheduledInvocation(
    'TraceCleanup',
    'rate(12 hours)',
    traceCleanupHandler,
    'Cleans up orphan traces and parallel barriers'
  );

  createScheduledInvocation(
    'MCPWarmup',
    'rate(1 hour)',
    mcpWarmupHandler,
    'Warms up MCP servers to reduce cold starts for tool execution'
  );

  createScheduledInvocation(
    'Concurrency',
    concurrencyMonitorRate,
    concurrencyMonitor,
    'Monitors Lambda concurrent execution usage — alerts at 80% utilization'
  );

  createScheduledInvocation(
    'CognitiveHealth',
    'rate(4 hours)',
    eventHandler,
    'Triggers cognitive health check to update Trust scores based on anomalies',
    {
      'detail-type': 'cognitive_health_check',
      detail: {
        traceId: `t-health-${Date.now()}`,
        sessionId: 'system-health',
      },
    }
  );
}
