// Export the ClawPlugin contract and associated types
export type {
  ClawPlugin,
  WebhookConfig,
  ApprovalPolicy,
} from '@serverlessclaw/core/lib/plugin-manager';

// Re-export common types that plugin authors might need
export type {
  IAgentConfig,
  ITool,
  IMemory,
  IProvider,
  MCPServerConfig,
} from '@serverlessclaw/core/lib/types/index';
