export interface ILockManager {
  acquire(lockId: string, ttlSeconds: number): Promise<boolean>;
  release(lockId: string): Promise<void>;
}

export interface SSTResource {
  MemoryTable: { name: string };
  TraceTable: { name: string };
  ConfigTable: { name: string };
  StagingBucket: { name: string };
  AgentBus: { name: string };
  WebhookApi: { url: string };
  Deployer: { name: string };
  TelegramBotToken: { value: string };
  OpenAIApiKey: { value: string };
  OpenRouterApiKey: { value: string };
  AwsRegion: { value: string };
}
