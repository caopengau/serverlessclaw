import { execSync } from 'child_process';
import {
  SharedContext,
  getValidSecrets,
  AGENT_CONFIG,
  getDomainConfig,
  LAMBDA_ARCHITECTURE,
  NODEJS_LOADERS,
  LOG_RETENTION_PERIOD,
} from './shared';

/**
 * Initializes the main API Gateway.
 *
 * @param ctx - The shared context (without agents).
 * @returns An object containing the created API resource.
 */
export function createApi(_ctx: SharedContext): { api: sst.aws.ApiGatewayV2 } {
  const apiDomain = getDomainConfig('api');
  const api = new sst.aws.ApiGatewayV2('WebhookApi', {
    domain: apiDomain,
  });

  return { api };
}

/**
 * Configures the routes for the API Gateway.
 * This is called after the agents have been created to allow linking.
 *
 * @param api - The API Gateway instance.
 * @param ctx - The shared context containing agents and other resources.
 */
export function configureApiRoutes(
  api: sst.aws.ApiGatewayV2,
  ctx: SharedContext,
  options: { pathPrefix?: string } = {}
): void {
  const prefix = options.pathPrefix ?? '';
  const {
    memoryTable,
    traceTable,
    configTable,
    stagingBucket,
    knowledgeBucket,
    secrets,
    bus,
    deployerLink,
  } = ctx;

  const validSecrets = getValidSecrets(secrets);

  // Global permissions for all API routes (if needed)
  const apiPermissions = [
    {
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
    },
  ];

  // Main Webhook
  const agents = ctx.agents;
  const criticalAgents = agents
    ? [
        agents.plannerAgent,
        agents.coderAgent,
        agents.reflectorAgent,
        agents.qaAgent,
        agents.mergerAgent,
      ].filter(Boolean)
    : [];

  const agentBuckets = agents
    ? {
        high: agents.coderAgent.arn,
        standard: agents.qaAgent.arn,
        light: agents.criticAgent.arn,
        runner: agents.agentRunner.arn,
      }
    : {};

  api.route('ANY /webhook', {
    handler: `${prefix}packages/core/handlers/webhook.handler`,
    nodejs: { loader: NODEJS_LOADERS },
    link: [
      memoryTable,
      traceTable,
      configTable,
      stagingBucket,
      knowledgeBucket,
      ...validSecrets,
      deployerLink,
      bus,
      ...criticalAgents,
    ],
    environment: {
      // Pass the ARNs for the smart warm-up utility
      WARM_UP_FUNCTIONS: $util.jsonStringify(agentBuckets),
    },
    permissions: [
      ...apiPermissions,
      ...(Object.keys(agentBuckets).length > 0
        ? [
            {
              actions: ['lambda:InvokeFunction'],
              resources: Object.values(agentBuckets),
            },
          ]
        : []),
    ],
    architecture: LAMBDA_ARCHITECTURE,
    timeout: AGENT_CONFIG.timeout.SHORT,
    logging: {
      retention: LOG_RETENTION_PERIOD,
    },
  });

  // Hub-and-Spoke Sync Webhook
  api.route('POST /webhook/sync', {
    handler: `${prefix}packages/core/handlers/sync-webhook.handler`,
    nodejs: { loader: NODEJS_LOADERS },
    link: [memoryTable, configTable, bus, ...validSecrets],
    permissions: [
      ...apiPermissions,
      {
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
        resources: [memoryTable.nodes.table.arn],
      },
    ],
    architecture: LAMBDA_ARCHITECTURE,
    memory: AGENT_CONFIG.memory.SMALL,
    timeout: AGENT_CONFIG.timeout.MEDIUM,
    logging: {
      retention: LOG_RETENTION_PERIOD,
    },
  });

  // Health Probe
  api.route('GET /health', {
    handler: `${prefix}packages/core/handlers/health.handler`,
    nodejs: { loader: NODEJS_LOADERS },
    link: [
      memoryTable,
      traceTable,
      configTable,
      stagingBucket,
      knowledgeBucket,
      bus,
      ...validSecrets,
    ],
    permissions: [
      ...apiPermissions,
      {
        actions: ['events:ListEventBuses'],
        resources: ['*'],
      },
      {
        actions: ['s3:ListAllMyBuckets'],
        resources: ['*'],
      },
      {
        actions: ['iot:DescribeEndpoint'],
        resources: ['*'],
      },
    ],
    architecture: LAMBDA_ARCHITECTURE,
    memory: '128 MB',
    timeout: AGENT_CONFIG.timeout.SHORT,
    environment: {
      GIT_HASH:
        process.env.GIT_HASH ||
        (() => {
          try {
            return execSync('git rev-parse HEAD').toString().trim();
          } catch {
            return 'dev';
          }
        })(),
      CONFIG_TABLE_NAME: configTable.name,
      MEMORY_TABLE_NAME: memoryTable.name,
      TRACE_TABLE_NAME: traceTable.name,
      STAGING_BUCKET_NAME: stagingBucket.name,
      KNOWLEDGE_BUCKET_NAME: knowledgeBucket.name,
      AGENT_BUS_NAME: bus.name,
    },
    logging: {
      retention: LOG_RETENTION_PERIOD,
    },
  });
}
