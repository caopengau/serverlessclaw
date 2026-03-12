export function createBus() {
  const bus = new sst.aws.Bus('AgentBus');
  const realtime = new sst.aws.Realtime('RealtimeBus', {
    authorizer: 'core/handlers/realtime-auth.handler',
  });
  return { bus, realtime };
}
