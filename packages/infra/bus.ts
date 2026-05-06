/**
 * Creates the event bus and realtime communication resources for agent orchestration.
 *
 * @returns An object containing the AgentBus (EventBridge), RealtimeBus (IoT Core), and DLQ (SQS) instances.
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
    visibilityTimeout: '2 minutes',
  });

  return { bus, realtime, dlq };
}
