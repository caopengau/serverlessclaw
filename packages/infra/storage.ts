import { STAGES } from './shared';

/**
 * Creates and configures the storage resources for the application.
 *
 * @returns An object containing the created DynamoDB tables, S3 buckets, and secrets.
 */
export function createStorage() {
  const memoryTable = new sst.aws.Dynamo('MemoryTable', {
    fields: {
      userId: 'string',
      timestamp: 'number',
      type: 'string',
      workspaceId: 'string',
    },
    primaryIndex: { hashKey: 'userId', rangeKey: 'timestamp' },
    globalIndexes: {
      TypeTimestampIndex: { hashKey: 'type', rangeKey: 'timestamp' },
      UserInsightIndex: { hashKey: 'userId', rangeKey: 'type' },
      WorkspaceTypeIndex: { hashKey: 'workspaceId', rangeKey: 'type' },
    },
    ttl: 'expiresAt',
    transform: {
      table: {
        billingMode: 'PAY_PER_REQUEST',
      },
    },
  });

  const traceTable = new sst.aws.Dynamo('TraceTable', {
    fields: {
      traceId: 'string',
      nodeId: 'string',
      userId: 'string',
      timestamp: 'number',
      agentId: 'string',
      workspaceId: 'string',
      status: 'string',
    },
    primaryIndex: { hashKey: 'traceId', rangeKey: 'nodeId' },
    globalIndexes: {
      UserIndex: { hashKey: 'userId', rangeKey: 'timestamp' },
      SummaryByNode: { hashKey: 'nodeId', rangeKey: 'timestamp' },
      AgentIdIndex: { hashKey: 'agentId', rangeKey: 'timestamp' },
      WorkspaceSummaryIndex: { hashKey: 'workspaceId', rangeKey: 'timestamp' },
      'status-index': { hashKey: 'status', rangeKey: 'timestamp' },
    },
    ttl: 'expiresAt',
    transform: {
      table: {
        billingMode: 'PAY_PER_REQUEST',
      },
    },
  });

  const stagingBucket = new sst.aws.Bucket('StagingBucket', {
    transform: {
      bucket: {
        lifecycleRules: [
          {
            id: 'expire-rubbish',
            enabled: true,
            expiration: {
              days: STAGING_EXPIRATION_DAYS,
            },
          },
        ],
      },
    },
  });

  const configTable = new sst.aws.Dynamo('ConfigTable', {
    fields: {
      key: 'string',
    },
    primaryIndex: { hashKey: 'key' },
    transform: {
      table: {
        billingMode: 'PAY_PER_REQUEST',
      },
    },
  });

  const knowledgeBucket = new sst.aws.Bucket('KnowledgeBucket', {
    transform: {
      bucket: {
        lifecycleRules: [
          {
            id: 'expire-user-uploads',
            enabled: true,
            expiration: {
              days: 90,
            },
          },
        ],
      },
    },
  });

  // Base secrets (always required in non-local stages)
  const baseSecretNames = [
    'TelegramBotToken',
    'MiniMaxApiKey',
    'OpenAIApiKey',
    'OpenRouterApiKey',
    'AwsRegion',
    'ActiveProvider',
    'ActiveModel',
    'GitHubToken',
    'GitHubWebhookSecret',
    'JiraWebhookSecret',
    'DashboardPassword',
  ];

  const secrets: Record<string, sst.Secret> = {};
  for (const name of baseSecretNames) {
    // In prod/dev, we always require these secrets to be set.
    // In local, we only declare them if they are actually provided (or if it's DashboardPassword, which we'll handle in dashboard.ts)
    // to avoid SecretMissingError during initial local setup.
    if ($app.stage !== STAGES.LOCAL || process.env[`SST_SECRET_${name}`]) {
      secrets[name] = new sst.Secret(name);
    }
  }

  // Conditionally add optional secrets to avoid undefined values in link arrays
  if ($app.stage === STAGES.PROD || process.env.SST_SECRET_DiscordBotToken) {
    secrets.DiscordBotToken = new sst.Secret('DiscordBotToken');
  }

  if ($app.stage === STAGES.PROD || process.env.SST_SECRET_SlackBotToken) {
    secrets.SlackBotToken = new sst.Secret('SlackBotToken');
  }

  return { memoryTable, traceTable, stagingBucket, knowledgeBucket, secrets, configTable };
}

const STAGING_EXPIRATION_DAYS = 30;
