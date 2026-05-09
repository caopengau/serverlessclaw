import { EventType } from '../../core/lib/types/agent';
import {
  SharedContext,
  AGENT_CONFIG,
  LAMBDA_ARCHITECTURE,
  NODEJS_LOADERS,
  LOG_RETENTION_PERIOD,
} from '../shared';

interface SystemHandlerOptions {
  prefix: string;
  liveInLocalOnly: boolean | undefined;
  baseLink: any[];
  basePermissions: any[];
  schedulerPermissions: any[];
  agentEnv: Record<string, any>;
  tenantFilter: any;
  dlq?: sst.aws.Queue;
}

export function createSystemHandlers(ctx: SharedContext, options: SystemHandlerOptions) {
  const { bus, memoryTable, dlq } = ctx;
  const {
    prefix,
    liveInLocalOnly,
    baseLink,
    basePermissions,
    schedulerPermissions,
    agentEnv,
    tenantFilter,
  } = options;

  // 3. Event Handler (System errors)
  const eventHandler = new sst.aws.Function('EventHandler', {
    handler: `${prefix}packages/core/handlers/events.handler`,
    dev: liveInLocalOnly as any,
    link: baseLink,
    permissions: [
      ...basePermissions,
      {
        actions: ['dynamodb:*'],
        resources: [
          memoryTable.nodes.table.arn,
          memoryTable.nodes.table.arn.apply((arn) => `${arn}/index/*`),
        ],
      },
    ],
    architecture: LAMBDA_ARCHITECTURE,
    nodejs: { loader: NODEJS_LOADERS },
    memory: AGENT_CONFIG.memory.MEDIUM,
    timeout: AGENT_CONFIG.timeout.MEDIUM,
    logging: {
      retention: LOG_RETENTION_PERIOD,
    },
  });

  bus.subscribe('EventHandlerSubscriber', eventHandler.arn, {
    pattern: {
      ...tenantFilter,
      detailType: [
        EventType.SYSTEM_BUILD_FAILED,
        EventType.SYSTEM_BUILD_SUCCESS,
        EventType.TASK_COMPLETED,
        EventType.TASK_FAILED,
        EventType.SYSTEM_HEALTH_REPORT,
        EventType.HEARTBEAT_PROACTIVE,
        EventType.CONTINUATION_TASK,
        EventType.TASK_CANCELLED,
        EventType.PARALLEL_TASK_DISPATCH,
        EventType.PARALLEL_TASK_COMPLETED,
        EventType.PARALLEL_BARRIER_TIMEOUT,
        EventType.CLARIFICATION_REQUEST,
        EventType.CLARIFICATION_TIMEOUT,
        EventType.DAG_TASK_COMPLETED,
        EventType.DAG_TASK_FAILED,
        EventType.ESCALATION_LEVEL_TIMEOUT,
        EventType.ESCALATION_COMPLETED,
        EventType.CONSENSUS_REQUEST,
        EventType.CONSENSUS_VOTE,
        EventType.COGNITIVE_HEALTH_CHECK,
        EventType.STRATEGIC_TIE_BREAK,
        EventType.REPORT_BACK,
        EventType.SYSTEM_AUDIT_TRIGGER,
        EventType.RECOVERY_LOG,
        EventType.DASHBOARD_FAILURE_DETECTED,
        EventType.DLQ_ROUTE,
        EventType.ORCHESTRATION_SIGNAL,
        EventType.DELEGATION_TASK,
        EventType.CONSENSUS_REACHED,
        EventType.HANDOFF,
        EventType.HEALTH_ALERT,
        EventType.REPUTATION_UPDATE,
      ],
    },
    transform: {
      target: {
        deadLetterConfig: dlq ? { arn: dlq.arn } : undefined,
      },
    },
  });

  // 8. Notifier
  const notifier = new sst.aws.Function('Notifier', {
    handler: `${prefix}packages/core/handlers/notifier.handler`,
    dev: liveInLocalOnly as any,
    link: baseLink,
    permissions: basePermissions,
    architecture: LAMBDA_ARCHITECTURE,
    nodejs: { loader: NODEJS_LOADERS },
    memory: AGENT_CONFIG.memory.SMALL,
    timeout: AGENT_CONFIG.timeout.SHORT,
    logging: {
      retention: LOG_RETENTION_PERIOD,
    },
  });

  bus.subscribe('OutboundMessageSubscriber', notifier.arn, {
    pattern: {
      ...tenantFilter,
      detailType: [EventType.OUTBOUND_MESSAGE],
    },
    transform: {
      target: {
        deadLetterConfig: dlq ? { arn: dlq.arn } : undefined,
      },
    },
  });

  // 8. Generic Agent Runner (Handles dynamic user-defined agents)
  const agentRunner = new sst.aws.Function('AgentRunner', {
    handler: `${prefix}packages/core/handlers/agent-runner.handler`,
    dev: liveInLocalOnly as any,
    link: baseLink,
    architecture: LAMBDA_ARCHITECTURE,
    nodejs: { loader: NODEJS_LOADERS },
    permissions: [...basePermissions, ...schedulerPermissions],
    environment: agentEnv,
    memory: AGENT_CONFIG.memory.LARGE,
    timeout: AGENT_CONFIG.timeout.MAX,
    logging: {
      retention: LOG_RETENTION_PERIOD,
    },
  });

  bus.subscribe('AgentRunnerSubscriber', agentRunner.arn, {
    pattern: {
      detailType: [{ prefix: 'dynamic_' }],
    },
    transform: {
      target: {
        deadLetterConfig: dlq ? { arn: dlq.arn } : undefined,
      },
    },
  });

  // 9. Realtime Bridge (EventBridge -> IoT Core)
  const bridge = new sst.aws.Function('RealtimeBridge', {
    handler: `${prefix}packages/core/handlers/bridge.handler`,
    dev: liveInLocalOnly as any,
    link: [...(ctx.realtime ? [ctx.realtime] : []), bus],
    permissions: basePermissions,
    architecture: LAMBDA_ARCHITECTURE,
    nodejs: { loader: NODEJS_LOADERS },
    memory: '128 MB',
    timeout: AGENT_CONFIG.timeout.SHORT,
    logging: {
      retention: LOG_RETENTION_PERIOD,
    },
  });

  bus.subscribe('RealtimeBridgeSubscriber', bridge.arn, {
    pattern: {
      detailType: [
        EventType.OUTBOUND_MESSAGE,
        EventType.CODER_TASK_COMPLETED,
        EventType.SYSTEM_BUILD_SUCCESS,
        EventType.SYSTEM_BUILD_FAILED,
        EventType.TASK_COMPLETED,
        EventType.TASK_FAILED,
        EventType.RECOVERY_LOG,
        EventType.SYSTEM_HEALTH_REPORT,
      ],
    },
    transform: {
      target: {
        deadLetterConfig: dlq ? { arn: dlq.arn } : undefined,
      },
    },
  });

  // B3: DLQ Handler for failed EventBridge events
  let dlqHandler: sst.aws.Function | undefined;
  if (dlq) {
    dlqHandler = new sst.aws.Function('DLQHandler', {
      handler: `${prefix}packages/core/handlers/dlq-handler.handler`,
      dev: liveInLocalOnly as any,
      link: [...baseLink, dlq],
      architecture: LAMBDA_ARCHITECTURE,
      nodejs: { loader: NODEJS_LOADERS },
      permissions: basePermissions,
      memory: AGENT_CONFIG.memory.SMALL,
      timeout: AGENT_CONFIG.timeout.MEDIUM,
      logging: {
        retention: LOG_RETENTION_PERIOD,
      },
    });

    // Subscribe DLQ handler to process failed events
    dlq.subscribe(dlqHandler.arn);
  }

  return {
    eventHandler,
    notifier,
    agentRunner,
    bridge,
    dlqHandler,
  };
}
