export function createStorage() {
  const memoryTable = new sst.aws.Dynamo('MemoryTable', {
    fields: {
      userId: 'string',
      timestamp: 'number',
    },
    primaryIndex: { hashKey: 'userId', rangeKey: 'timestamp' },
  });

  const traceTable = new sst.aws.Dynamo('TraceTable', {
    fields: {
      traceId: 'string',
      userId: 'string',
      timestamp: 'number',
    },
    primaryIndex: { hashKey: 'traceId', rangeKey: 'timestamp' },
    globalIndexes: {
      UserIndex: { hashKey: 'userId', rangeKey: 'timestamp' },
    },
    ttl: 'expiresAt',
  });

  const stagingBucket = new sst.aws.Bucket('StagingBucket');

  const configTable = new sst.aws.Dynamo('ConfigTable', {
    fields: {
      key: 'string',
    },
    primaryIndex: { hashKey: 'key' },
  });

  const secrets = {
    TELEGRAM_BOT_TOKEN: new sst.Secret('TelegramBotToken'),
    OPENAI_API_KEY: new sst.Secret('OpenAIApiKey'),
    OPENROUTER_API_KEY: new sst.Secret('OpenRouterApiKey'),
    AWS_REGION: new sst.Secret('AwsRegion'),
    ACTIVE_PROVIDER: new sst.Secret('ActiveProvider'),
    ACTIVE_MODEL: new sst.Secret('ActiveModel'),
    // We don't initialize GitHubToken here to make it optional for the deploy to start
  };

  return { memoryTable, traceTable, stagingBucket, secrets, configTable };
}
