import {
  SharedContext,
  getValidSecrets,
  getTenantEventFilter,
  AgentFunctionResources,
} from './shared';
import { MCPServerResources } from './mcp-servers';
import { createMultiplexers } from './agents/multiplexers';
import { createSystemHandlers } from './agents/system-handlers';
import { createMonitors } from './agents/monitors';
import {
  createMaintenanceHandlers,
  setupMaintenanceSchedules,
} from './agents/maintenance-handlers';

const RECOVERY_SCHEDULE_RATE = 'rate(2 hours)';
const CONCURRENCY_MONITOR_RATE = 'rate(12 hours)';

/**
 * Deploys the full set of autonomous agents as Lambda functions and sets up their event subscriptions.
 *
 * @param ctx - The shared context containing system resources.
 * @param mcpServers - Optional MCP server resources to link.
 * @returns A record of the created agent function resources.
 */
export function createAgents(
  ctx: SharedContext,
  mcpServers?: MCPServerResources,
  options: { pathPrefix?: string } = {}
): AgentFunctionResources {
  const prefix = options.pathPrefix ?? '';
  const { memoryTable, traceTable, configTable, knowledgeBucket, secrets, bus, dlq } = ctx;

  const validSecrets = getValidSecrets(secrets);
  const liveInLocalOnly = $app.stage === 'local' ? undefined : false;

  // Tenant filtering logic
  const authorizedOrgs = process.env.AUTHORIZED_ORGS?.split(',').filter(Boolean);
  const tenantFilter = getTenantEventFilter({
    requireWorkspace: true,
    orgId: authorizedOrgs && authorizedOrgs.length > 0 ? authorizedOrgs : undefined,
  });

  // Base resources linked to all agents
  const baseLink = [
    bus,
    memoryTable,
    traceTable,
    configTable,
    knowledgeBucket,
    ...validSecrets,
    ...(ctx.realtime ? [ctx.realtime] : []),
  ];

  const basePermissions = [
    {
      actions: ['cloudwatch:PutMetricData', 'iot:Publish'],
      resources: ['*'],
    },
    ...(mcpServers
      ? [
          {
            actions: ['lambda:InvokeFunction'],
            resources: [
              mcpServers.multiplexer.arn,
              mcpServers.browserMultiplexer.arn,
              mcpServers.devOpsMultiplexer.arn,
            ],
          },
        ]
      : []),
  ];

  // Permissions for managing schedules
  const schedulerPermissions = [
    {
      actions: [
        'scheduler:CreateSchedule',
        'scheduler:DeleteSchedule',
        'scheduler:GetSchedule',
        'scheduler:ListSchedules',
        'scheduler:UpdateSchedule',
      ],
      resources: ['*'],
    },
  ];

  const agentEnv = {
    TRACE_SUMMARIES_ENABLED: 'true',
    ...(mcpServers
      ? {
          MCP_SERVER_ARNS: $util.jsonStringify({
            git: mcpServers.multiplexer.arn,
            filesystem: mcpServers.multiplexer.arn,
            'google-search': mcpServers.multiplexer.arn,
            fetch: mcpServers.multiplexer.arn,
            ast: mcpServers.multiplexer.arn,
            puppeteer: mcpServers.browserMultiplexer.arn,
            playwright: mcpServers.browserMultiplexer.arn,
            aws: mcpServers.devOpsMultiplexer.arn,
            'aws-s3': mcpServers.devOpsMultiplexer.arn,
          }),
        }
      : {}),
  };

  // 1. Create Multiplexers
  const { highPowerMultiplexer, standardMultiplexer, lightMultiplexer } = createMultiplexers(ctx, {
    prefix,
    liveInLocalOnly,
    baseLink,
    basePermissions,
    schedulerPermissions,
    agentEnv,
    tenantFilter,
    dlq,
  });

  // 2. Create System Handlers
  const { eventHandler, notifier, agentRunner, bridge, dlqHandler } = createSystemHandlers(ctx, {
    prefix,
    liveInLocalOnly,
    baseLink,
    basePermissions,
    schedulerPermissions,
    agentEnv,
    tenantFilter,
    dlq,
  });

  // 3. Create Monitors
  const { buildMonitor, concurrencyMonitor } = createMonitors(ctx, {
    prefix,
    liveInLocalOnly,
    baseLink,
    basePermissions,
  });

  // 4. Create Maintenance Handlers
  const maintenance = createMaintenanceHandlers(ctx, {
    prefix,
    liveInLocalOnly,
    baseLink,
    basePermissions,
    agentEnv,
    recoveryScheduleRate: RECOVERY_SCHEDULE_RATE,
  });

  // 5. Setup Schedules
  setupMaintenanceSchedules(
    maintenance,
    eventHandler,
    concurrencyMonitor,
    CONCURRENCY_MONITOR_RATE
  );

  return {
    coderAgent: highPowerMultiplexer,
    researcherAgent: highPowerMultiplexer,
    plannerAgent: highPowerMultiplexer,
    qaAgent: standardMultiplexer,
    criticAgent: lightMultiplexer,
    reflectorAgent: lightMultiplexer,
    mergerAgent: lightMultiplexer,
    buildMonitor,
    eventHandler,
    deadMansSwitch: maintenance.deadMansSwitch,
    notifier,
    agentRunner,
    bridge,
    heartbeatHandler: maintenance.heartbeatHandler,
    concurrencyMonitor,
    maintenanceHandler: maintenance.maintenanceHandler,
    traceCleanupHandler: maintenance.traceCleanupHandler,
    schedulerRole: maintenance.schedulerRole,
    dlqHandler,
  };
}
