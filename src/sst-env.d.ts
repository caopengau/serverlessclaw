declare module 'sst' {
  export const Resource: {
    MemoryTable: {
      name: string;
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
    [key: string]: any;
  };
}
