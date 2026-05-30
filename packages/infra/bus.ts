/**
 * Creates the event bus and realtime communication resources for agent orchestration.
 *
 * @returns An object containing the AgentBus (EventBridge), RealtimeBus (IoT Core),
 *          DLQ (SQS), and PlannerQueue (SQS FIFO) instances.
 */
export function createBus(options: { pathPrefix?: string } = {}) {
  const prefix = options.pathPrefix ?? '';
  const bus = new sst.aws.Bus('AgentBus');
  const realtime = new sst.aws.Realtime('RealtimeBus', {
    authorizer: {
      handler: `${prefix}packages/core/handlers/realtime-auth.handler`,
      logging: {
        retention: '1 month',
      },
    },
  });

  // B3: Dead Letter Queue for EventBridge failed events
  const dlq = new sst.aws.Queue('EventDLQ', {
    transform: {
      queue: {
        messageRetentionSeconds: 14 * 24 * 60 * 60, // 14 days retention
        visibilityTimeoutSeconds: 300, // 5 minutes visibility timeout
        receiveMessageWaitTimeSeconds: 20, // Enable long polling to reduce API calls
      },
    },
  });

  // FIFO queue for strategic planner tasks — guarantees serial execution per workspace
  // and eliminates the concurrent GAP_LOCK races that plague the self-evolution loop.
  // MessageGroupId = workspaceId ensures one in-flight planner task per workspace.
  // Note: SQS FIFO queues require a FIFO DLQ — cannot reuse the standard EventDLQ.
  const plannerDlq = new sst.aws.Queue('PlannerDLQ', {
    fifo: true,
    transform: {
      queue: {
        messageRetentionSeconds: 14 * 24 * 60 * 60, // 14 days
        visibilityTimeoutSeconds: 60,
      },
    },
  });

  const plannerQueue = new sst.aws.Queue('PlannerQueue', {
    fifo: true,
    transform: {
      queue: {
        contentBasedDeduplication: true, // dedup identical messages within 5-min window
        visibilityTimeoutSeconds: 660, // must exceed Lambda max timeout (600 s)
        messageRetentionSeconds: 4 * 24 * 60 * 60, // 4 days
        receiveMessageWaitTimeSeconds: 20,
        redrivePolicy: $util.jsonStringify({
          deadLetterTargetArn: plannerDlq.arn,
          maxReceiveCount: 3,
        }),
      },
    },
  });

  return { bus, realtime, dlq, plannerQueue };
}
