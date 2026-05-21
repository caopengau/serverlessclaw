import { SharedContext, getDomainConfig, AGENT_CONFIG, getValidSecrets } from './shared';

/**
 * Deploys the Next.js dashboard for monitoring and managing the agents.
 *
 * @param ctx - The shared context containing system resources.
 * @param options - Optional configuration for infrastructure deployment (e.g., pathPrefix).
 * @returns An object containing the created dashboard resource.
 */
export function createDashboard(
  ctx: SharedContext,
  options: {
    pathPrefix?: string;
    extensionSource?: string;
    theme?: {
      primaryColor?: string;
      primaryColorDark?: string;
      accentColor?: string;
      accentColorDark?: string;
      appTitle?: string;
    };
  } = {}
): { dashboard: sst.aws.Nextjs } {
  const prefix = options.pathPrefix ?? '';
  const extSource = options.extensionSource ?? '';
  const {
    memoryTable,
    traceTable,
    configTable,
    stagingBucket,
    knowledgeBucket,
    bus,
    deployer,
    deployerLink,
    api,
    schedulerRole,
    heartbeatHandler,
  } = ctx;

  const dashboard = new sst.aws.Nextjs('MissionControl', {
    path: `${prefix}apps/dashboard`,
    domain: getDomainConfig('dashboard'),
    // Disable warmer to save SQS requests/costs
    warm: 0,
    link: [
      memoryTable,
      traceTable,
      configTable,
      stagingBucket,
      knowledgeBucket,
      bus,
      deployerLink, // Added for topology discovery
      ...(api ? [api] : []),
      ...(ctx.realtime ? [ctx.realtime] : []),
      ...(ctx.multiplexer ? [ctx.multiplexer] : []), // Added for topology discovery
      ...getValidSecrets(ctx.secrets),
    ].filter(Boolean),
    environment: {
      DEPLOYER_NAME: deployer.name || 'default',
      DYNAMIC_SCHEDULER_ROLE_ARN: schedulerRole?.arn || '',
      HEARTBEAT_HANDLER_ARN: heartbeatHandler?.arn || '',
      API_URL: api?.url || '',
      STAGING_BUCKET_NAME: stagingBucket.name,
      KNOWLEDGE_BUCKET_NAME: knowledgeBucket.name,
      AGENT_BUS_NAME: bus.name,
      TRACE_TABLE_NAME: traceTable.name,
      MEMORY_TABLE_NAME: memoryTable.name,
      CONFIG_TABLE_NAME: configTable.name,
      WEBHOOK_API_URL: api?.url || '',
      IOT_ENDPOINT: ctx.realtime?.endpoint || '',
      IOT_AUTHORIZER: ctx.realtime?.authorizer || '',
      DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD || '',
      AWS_PROFILE: '', // Clear profile to avoid conflict warning as SST injects static credentials
      NEXT_PUBLIC_PRIMARY_COLOR:
        options.theme?.primaryColor || process.env.NEXT_PUBLIC_PRIMARY_COLOR || '',
      NEXT_PUBLIC_PRIMARY_COLOR_DARK:
        options.theme?.primaryColorDark || process.env.NEXT_PUBLIC_PRIMARY_COLOR_DARK || '',
      NEXT_PUBLIC_ACCENT_COLOR:
        options.theme?.accentColor || process.env.NEXT_PUBLIC_ACCENT_COLOR || '',
      NEXT_PUBLIC_ACCENT_COLOR_DARK:
        options.theme?.accentColorDark || process.env.NEXT_PUBLIC_ACCENT_COLOR_DARK || '',
      NEXT_PUBLIC_APP_TITLE: options.theme?.appTitle || process.env.NEXT_PUBLIC_APP_TITLE || '',
    },
    architecture: 'arm64',
    buildCommand: `mkdir -p src/extensions/hub && find src/extensions/hub -mindepth 1 -maxdepth 1 ! -name 'index.ts' -exec rm -rf {} + && ${
      extSource ? `cp -rL ${extSource} src/extensions/hub/ && ` : ''
    }npx open-next build && rm -rf .open-next/server-functions/default/.aiready .open-next/server-functions/default/.sst .open-next/server-functions/default/.turbo .open-next/server-functions/default/.github .open-next/server-functions/default/.husky`,
    server: {
      memory: AGENT_CONFIG.memory.LARGE,
      timeout: AGENT_CONFIG.timeout.LONG,
      // Ensure runtime packages are present in Lambda package when esbuild externalizes them.
      install: ['next', 'react', 'react-dom', '@swc/helpers'],
    },

    permissions: [
      {
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
        resources: [
          stagingBucket.arn,
          $util.interpolate`${stagingBucket.arn}/*`,
          knowledgeBucket.arn,
          $util.interpolate`${knowledgeBucket.arn}/*`,
        ],
      },
      {
        actions: ['events:PutEvents'],
        resources: [bus.arn],
      },
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
      ...(schedulerRole
        ? [
            {
              actions: ['iam:PassRole'],
              resources: [schedulerRole.arn],
            },
          ]
        : []),
      {
        actions: ['dynamodb:*'],
        resources: [
          memoryTable.nodes.table.arn,
          $util.interpolate`${memoryTable.nodes.table.arn}/index/*`,
          traceTable.nodes.table.arn,
          $util.interpolate`${traceTable.nodes.table.arn}/index/*`,
          configTable.nodes.table.arn,
          $util.interpolate`${configTable.nodes.table.arn}/index/*`,
        ],
      },
      {
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      },
    ],
  });

  return { dashboard };
}
