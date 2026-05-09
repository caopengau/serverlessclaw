import { EventType } from '../../core/lib/types/agent';
import {
  SharedContext,
  AGENT_CONFIG,
  LAMBDA_ARCHITECTURE,
  NODEJS_LOADERS,
  LOG_RETENTION_PERIOD,
} from '../shared';

interface MultiplexerOptions {
  prefix: string;
  liveInLocalOnly: boolean | undefined;
  baseLink: any[];
  basePermissions: any[];
  schedulerPermissions: any[];
  agentEnv: Record<string, any>;
  tenantFilter: any;
  dlq?: sst.aws.Queue;
}

export function createMultiplexers(ctx: SharedContext, options: MultiplexerOptions) {
  const { bus, stagingBucket, deployerLink } = ctx;
  const {
    prefix,
    liveInLocalOnly,
    baseLink,
    basePermissions,
    schedulerPermissions,
    agentEnv,
    tenantFilter,
    dlq,
  } = options;

  // 1. High-Power Multiplexer (Coder, Researcher, Strategic Planner)
  const highPowerMultiplexer = new sst.aws.Function('HighPowerMultiplexer', {
    handler: `${prefix}packages/core/handlers/agent-multiplexer.handler`,
    dev: liveInLocalOnly as any,
    link: [...baseLink, stagingBucket, deployerLink],
    permissions: [...basePermissions, ...schedulerPermissions],
    architecture: LAMBDA_ARCHITECTURE,
    nodejs: { loader: NODEJS_LOADERS },
    environment: { ...agentEnv, MULTIPLEXER_TIER: 'high' },
    memory: AGENT_CONFIG.memory.LARGE,
    timeout: AGENT_CONFIG.timeout.MAX,
    logging: { retention: LOG_RETENTION_PERIOD },
  });

  bus.subscribe('HighPowerSubscriber', highPowerMultiplexer.arn, {
    pattern: {
      ...tenantFilter,
      detailType: [
        EventType.CODER_TASK,
        EventType.RESEARCH_TASK,
        EventType.EVOLUTION_PLAN,
        EventType.STRATEGIC_PLANNER_TASK,
      ],
    },
    transform: { target: { deadLetterConfig: dlq ? { arn: dlq.arn } : undefined } },
  });

  // 2. Standard Multiplexer (QA, Facilitator)
  const standardMultiplexer = new sst.aws.Function('StandardMultiplexer', {
    handler: `${prefix}packages/core/handlers/agent-multiplexer.handler`,
    dev: liveInLocalOnly as any,
    link: [...baseLink, deployerLink],
    permissions: [...basePermissions, ...schedulerPermissions],
    architecture: LAMBDA_ARCHITECTURE,
    nodejs: { loader: NODEJS_LOADERS },
    environment: { ...agentEnv, MULTIPLEXER_TIER: 'standard' },
    memory: AGENT_CONFIG.memory.MEDIUM_LARGE,
    timeout: AGENT_CONFIG.timeout.MAX,
    logging: { retention: LOG_RETENTION_PERIOD },
  });

  bus.subscribe('StandardSubscriber', standardMultiplexer.arn, {
    pattern: {
      ...tenantFilter,
      detailType: [
        EventType.CODER_TASK_COMPLETED, // QA trigger
        EventType.SYSTEM_BUILD_SUCCESS, // QA trigger
        EventType.QA_TASK,
        EventType.FACILITATOR_TASK,
      ],
    },
    transform: { target: { deadLetterConfig: dlq ? { arn: dlq.arn } : undefined } },
  });

  // 3. Light Multiplexer (Critic, Reflector, Merger)
  const lightMultiplexer = new sst.aws.Function('LightMultiplexer', {
    handler: `${prefix}packages/core/handlers/agent-multiplexer.handler`,
    dev: liveInLocalOnly as any,
    link: [...baseLink, stagingBucket, deployerLink],
    permissions: [...basePermissions, ...schedulerPermissions],
    architecture: LAMBDA_ARCHITECTURE,
    nodejs: { loader: NODEJS_LOADERS },
    environment: { ...agentEnv, MULTIPLEXER_TIER: 'light' },
    memory: AGENT_CONFIG.memory.MEDIUM,
    timeout: AGENT_CONFIG.timeout.LONG,
    logging: { retention: LOG_RETENTION_PERIOD },
  });

  bus.subscribe('LightSubscriber', lightMultiplexer.arn, {
    pattern: {
      ...tenantFilter,
      detailType: [
        EventType.REFLECT_TASK,
        EventType.CRITIC_TASK,
        EventType.MERGER_TASK,
        EventType.COGNITION_REFLECTOR_TASK,
      ],
    },
    transform: { target: { deadLetterConfig: dlq ? { arn: dlq.arn } : undefined } },
  });

  return {
    highPowerMultiplexer,
    standardMultiplexer,
    lightMultiplexer,
  };
}
