declare module 'sst' {
  export const Resource: {
    MemoryTable: {
      name: string;
    };
    TraceTable: {
      name: string;
    };
    StagingBucket: {
      name: string;
    };
    WebhookApi: {
      url: string;
    };
    TelegramBotToken: {
      value: string;
    };
    OpenAIApiKey: {
      value: string;
    };
    Deployer: {
      name: string;
    };
    AgentBus: {
      name: string;
    };
    [key: string]: unknown;
  };
}
