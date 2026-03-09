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
    [key: string]: any;
  };
}
