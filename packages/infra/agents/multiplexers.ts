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
  baseLink: unknown[];
  basePermissions: unknown[];
  schedulerPermissions: unknown[];
  agentEnv: Record<string, string>;
  tenantFilter: Record<string, unknown>;
  dlq?: sst.aws.Queue;
  plannerQueue?: sst.aws.Queue;
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
    plannerQueue,
  } = options;

  // 1. High-Power Multiplexer (Coder, Researcher)
  // NOTE: STRATEGIC_PLANNER_TASK and EVOLUTION_PLAN are intentionally excluded here.
  //       They are now routed via PlannerQueue (SQS FIFO) to prevent concurrent
  //       gap-lock races in the self-evolution loop.
  const highPowerMultiplexer = new sst.aws.Function('HighPowerMultiplexer', {
    handler: `${prefix}packages/core/handlers/agent-multiplexer.handler`,
    dev: liveInLocalOnly,
    link: [...baseLink, stagingBucket, deployerLink].filter(Boolean) as sst.Linkable<
      Record<string, unknown>
    >[],
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
        // EVOLUTION_PLAN + STRATEGIC_PLANNER_TASK removed — now serial via PlannerQueue
      ],
    },
    transform: { target: { deadLetterConfig: dlq ? { arn: dlq.arn } : undefined } },
  });

  // 1b. Planner Consumer — dedicated SQS FIFO consumer for strategic planner tasks.
  //     batchSize=1 + FIFO MessageGroupId=workspaceId means only one planner task
  //     runs per workspace at a time, eliminating concurrent GAP_LOCK races.
  let plannerConsumer: sst.aws.Function | undefined;
  if (plannerQueue) {
    plannerConsumer = plannerQueue.subscribe(
      {
        handler: `${prefix}packages/core/handlers/agent-multiplexer.handler`,
        dev: liveInLocalOnly,
        link: [...baseLink, stagingBucket, deployerLink].filter(Boolean) as sst.Linkable<
          Record<string, unknown>
        >[],
        permissions: [...basePermissions, ...schedulerPermissions],
        architecture: LAMBDA_ARCHITECTURE,
        nodejs: { loader: NODEJS_LOADERS },
        environment: { ...agentEnv, MULTIPLEXER_TIER: 'planner' },
        memory: AGENT_CONFIG.memory.LARGE,
        timeout: AGENT_CONFIG.timeout.MAX,
        logging: { retention: LOG_RETENTION_PERIOD },
      },
      { batch: { size: 1 } }
    );
  }

  // 2. Standard Multiplexer (QA, Facilitator)
  const standardMultiplexer = new sst.aws.Function('StandardMultiplexer', {
    handler: `${prefix}packages/core/handlers/agent-multiplexer.handler`,
    dev: liveInLocalOnly,
    link: [...baseLink, deployerLink].filter(Boolean) as sst.Linkable<Record<string, unknown>>[],
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
    dev: liveInLocalOnly,
    link: [...baseLink, stagingBucket, deployerLink].filter(Boolean) as sst.Linkable<
      Record<string, unknown>
    >[],
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
    plannerConsumer,
  };
}
