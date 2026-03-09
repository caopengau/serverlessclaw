export function createStorage() {
  const memoryTable = new sst.aws.DynamoDB('MemoryTable', {
    fields: {
      userId: 'string',
      timestamp: 'number',
    },
    primaryIndex: { hashKey: 'userId', rangeKey: 'timestamp' },
  });

  const secrets = {
    TELEGRAM_BOT_TOKEN: new sst.Secret('TelegramBotToken'),
    OPENAI_API_KEY: new sst.Secret('OpenAIApiKey'),
  };

  const traceTable = new sst.aws.DynamoDB('TraceTable', {
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

  return { memoryTable, traceTable, secrets };
}
