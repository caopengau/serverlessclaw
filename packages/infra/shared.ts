/**
 * Represents the record of autonomous agent function resources.
 * Defined here to avoid circular dependencies between agents.ts and shared.ts.
 */
export interface AgentFunctionResources {
  coderAgent: sst.aws.Function;
  buildMonitor: sst.aws.Function;
  eventHandler: sst.aws.Function;
  deadMansSwitch: sst.aws.Function;
  plannerAgent: sst.aws.Function;
  reflectorAgent: sst.aws.Function;
  criticAgent: sst.aws.Function;
  notifier: sst.aws.Function;
  agentRunner: sst.aws.Function;
  bridge: sst.aws.Function;
  heartbeatHandler: sst.aws.Function;
  concurrencyMonitor: sst.aws.Function;
  maintenanceHandler: sst.aws.Function;
  traceCleanupHandler: sst.aws.Function;
  mergerAgent: sst.aws.Function;
  qaAgent: sst.aws.Function;
  researcherAgent: sst.aws.Function;
  schedulerRole: aws.iam.Role;
  dlqHandler?: sst.aws.Function;
}

/**
 * Represents the shared resource context passed between infrastructure modules.
 */
export interface SharedContext {
  memoryTable: sst.aws.Dynamo;
  traceTable: sst.aws.Dynamo;
  configTable: sst.aws.Dynamo;
  stagingBucket: sst.aws.Bucket;
  knowledgeBucket: sst.aws.Bucket;
  secrets: Record<string, sst.Secret>;
  bus: sst.aws.Bus;
  deployer: aws.codebuild.Project;
  deployerLink: sst.Linkable<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  api?: sst.aws.ApiGatewayV2;
  realtime?: sst.aws.Realtime;
  heartbeatHandler?: sst.aws.Function;
  schedulerRole?: aws.iam.Role;
  dlq?: sst.aws.Queue;
  multiplexer?: sst.aws.Function;
  agents?: AgentFunctionResources;
}

/**
 * Filter out any undefined secrets before linking to resources.
 *
 * @param secrets - A record of secret names to SST Secret objects.
 * @returns An array of valid (non-undefined) SST Secret objects.
 */
export function getValidSecrets(secrets: Record<string, sst.Secret>): sst.Secret[] {
  return Object.values(secrets).filter((s) => s !== undefined);
}

/**
 * Common configuration for agent functions including memory tiers and timeouts.
 */
export const AGENT_CONFIG = {
  memory: {
    SMALL: '256 MB',
    MEDIUM: '512 MB',
    MEDIUM_LARGE: '768 MB',
    LARGE: '2048 MB',
  },
  timeout: {
    SHORT: '30 seconds',
    MEDIUM: '60 seconds',
    LONG: '300 seconds',
    MAX: '600 seconds',
  },
} as const;

/** Lambda runtime architecture for all agent functions */
export const LAMBDA_ARCHITECTURE = 'arm64';

/** Node.js loader configuration for markdown files */
export const NODEJS_LOADERS = { '.md': 'text' } as const;

/** Default log retention period for Lambda functions */
export const LOG_RETENTION_PERIOD = '1 week';

/** Deployment stage identifiers */
export const STAGES = {
  PROD: 'prod',
  DEV: 'dev',
  LOCAL: 'local',
} as const;

/**
 * Generates a tenant-aware EventBridge filter pattern.
 * Enforces organizational and team-level boundaries at the infrastructure layer (Silo 1).
 */
export function getTenantEventFilter(options: {
  orgId?: string[];
  teamId?: string[];
  requireWorkspace?: boolean;
}) {
  const pattern: { detail: Record<string, any> } = {
    detail: {},
  };

  if (options.orgId) {
    pattern.detail.orgId = options.orgId;
  }
  if (options.teamId) {
    pattern.detail.teamId = options.teamId;
  }
  if (options.requireWorkspace) {
    // Optimization: Ensure workspaceId exists to filter out malformed global events
    pattern.detail.workspaceId = [{ exists: true }];
  }

  return pattern;
}

/**
 * Retrieves the optional domain configuration for a component.
 *
 * @param component - The component to get the domain for ('api' | 'dashboard' | 'router' | 'landing').
 * @returns The domain configuration or undefined if not set.
 */
export function getDomainConfig(_component: 'api' | 'dashboard' | 'router' | 'landing'):
  | {
      name: string;
      dns?: ReturnType<typeof sst.cloudflare.dns>;
      cert?: string;
    }
  | undefined {
  // CUSTOM_DOMAIN_BYPASS: Temporarily disabled to bypass Cloudflare conflicts
  return undefined;
}
