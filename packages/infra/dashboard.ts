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
      logo?: string;
      logoBanner?: string;
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
      JOBS_CONFIG_PATH: 'apps/dashboard/jobs.config.json',
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
      NEXT_PUBLIC_APP_LOGO: options.theme?.logo || process.env.NEXT_PUBLIC_APP_LOGO || '/icon.png',
      NEXT_PUBLIC_APP_LOGO_BANNER:
        options.theme?.logoBanner || process.env.NEXT_PUBLIC_APP_LOGO_BANNER || '',
      ...(options.extensionSource
        ? { NEXT_PUBLIC_ACTIVE_EXTENSIONS: './src/extensions/project/index.tsx' }
        : {}),
    },
    architecture: 'arm64',
    buildCommand: `mkdir -p src/extensions/project && find src/extensions/ -mindepth 1 -maxdepth 1 ! -name 'index.ts' ! -name 'messages' ! -name 'project' -exec rm -rf {} + && ${
      extSource
        ? `([ -d "../../../${extSource}/public" ] && cp -rL ../../../${extSource}/public/* public/) || true && cp -rL ../../../${extSource}/* src/extensions/project/ && cp -L ../../../${extSource}/jobs.config.json . && `
        : ''
    }NODE_OPTIONS=--max-old-space-size=6144 npx open-next build && rm -rf .open-next/server-functions/default/.git .open-next/server-functions/default/.github .open-next/server-functions/default/.husky .open-next/server-functions/default/.aiready .open-next/server-functions/default/.sst .open-next/server-functions/default/.turbo .open-next/server-functions/default/docs .open-next/server-functions/default/makefiles .open-next/server-functions/default/scripts .open-next/server-functions/default/e2e .open-next/server-functions/default/reports .open-next/server-functions/default/.kilo .open-next/server-functions/default/.opencode .open-next/server-functions/default/apps/dashboard/src .open-next/server-functions/default/packages/*/src .open-next/server-functions/default/coverage .open-next/server-functions/default/tsconfig.tsbuildinfo .open-next/server-functions/default/node_modules/caniuse-lite .open-next/server-functions/default/node_modules/.pnpm/webpack* .open-next/server-functions/default/node_modules/.pnpm/terser* .open-next/server-functions/default/node_modules/next/dist/compiled/webpack .open-next/server-functions/default/node_modules/next/dist/compiled/next-devtools .open-next/server-functions/default/node_modules/next/dist/compiled/babel* .open-next/server-functions/default/node_modules/next/dist/compiled/@babel .open-next/server-functions/default/node_modules/next/dist/compiled/terser .open-next/server-functions/default/node_modules/next/dist/compiled/postcss-preset-env .open-next/server-functions/default/node_modules/next/dist/compiled/cssnano-simple .open-next/server-functions/default/node_modules/next/dist/compiled/react-dom-experimental .open-next/server-functions/default/node_modules/next/dist/compiled/react-server-dom-webpack-experimental .open-next/server-functions/default/node_modules/next/dist/compiled/react-server-dom-turbopack-experimental .open-next/server-functions/default/node_modules/next/dist/compiled/react-server-dom-turbopack .open-next/server-functions/default/node_modules/next/dist/esm .open-next/server-functions/default/node_modules/next/dist/build .open-next/server-functions/default/node_modules/next/dist/docs .open-next/server-functions/default/node_modules/next/dist/bundle-analyzer .open-next/server-functions/default/node_modules/.pnpm/tree-sitter* .open-next/server-functions/default/node_modules/.pnpm/@swc+core* .open-next/server-functions/default/node_modules/.pnpm/esbuild* .open-next/server-functions/default/node_modules/.pnpm/typescript* .open-next/server-functions/default/node_modules/.pnpm/puppeteer* .open-next/server-functions/default/node_modules/tree-sitter .open-next/server-functions/default/node_modules/@swc/core .open-next/server-functions/default/node_modules/esbuild .open-next/server-functions/default/node_modules/typescript .open-next/server-functions/default/packages/infra .open-next/server-functions/default/packages/*/coverage .open-next/server-functions/default/apps/cli .open-next/server-functions/default/apps/*/coverage .open-next/server-functions/default/packages/integration-github .open-next/server-functions/default/pnpm-lock.yaml .open-next/server-functions/default/pnpm-lock.yaml.oss || true && echo "=== Bundle size after cleanup ===" && du -sh .open-next/server-functions/default/ && du -sh .open-next/server-functions/default/node_modules/next/ || true`,
    server: {
      memory: AGENT_CONFIG.memory.LARGE,
      timeout: AGENT_CONFIG.timeout.MEDIUM,
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
