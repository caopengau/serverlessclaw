/**
 * Resolves the appropriate handler for a given event type.
 */
export async function getHandlerForEvent(
  event: any,
  detailType: string,
  traceId: string,
  sessionId: string,
  eventDetail: any
) {
  const { logger: localLogger } = await import('../../lib/logger');
  const { ConfigManager } = await import('../../lib/registry/config');
  const { DEFAULT_EVENT_ROUTING } = await import('../../lib/event-routing');

  const workspaceId = (eventDetail?.workspaceId as string) || undefined;
  const scope = { workspaceId };

  // Fetch routing configuration
  const rawRoutingTable = await ConfigManager.getTypedConfig(
    'event_routing_table',
    DEFAULT_EVENT_ROUTING
  );
  const ALLOWED_COMBINATIONS = new Set(
    Object.values(DEFAULT_EVENT_ROUTING).map((r: any) => `${r.module}:${r.function}`)
  );

  const routingTable: Record<string, { module: string; function: string; passContext?: boolean }> =
    {
      ...DEFAULT_EVENT_ROUTING,
    };
  if (rawRoutingTable !== DEFAULT_EVENT_ROUTING) {
    for (const [eventType, entry] of Object.entries(
      rawRoutingTable as Record<string, { module: string; function: string }>
    )) {
      const routeEntry = entry as { module: string; function: string };
      const combination = `${routeEntry.module}:${routeEntry.function}`;
      if (ALLOWED_COMBINATIONS.has(combination)) {
        routingTable[eventType] = routeEntry;
      } else {
        localLogger.warn(
          `[SECURITY] Blocked unrecognised routing combination '${combination}' for event type '${eventType}'. Using default.`
        );
      }
    }
  }

  const routing = routingTable[detailType] || (DEFAULT_EVENT_ROUTING as any)[detailType];
  if (!routing) {
    localLogger.error(`[ROUTING] No handler found for event type: ${detailType}`);
    const { routeToDlq } = await import('../route-to-dlq');
    const { emitMetrics, METRICS } = await import('../../lib/metrics');
    await routeToDlq(event, detailType, 'SYSTEM', traceId, `No routing for ${detailType}`);
    emitMetrics([METRICS.dlqEvents(1, scope)]).catch(() => {});
    return null;
  }

  const { HANDLER_LOADERS } = await import('./handlers-map');
  const loader = (HANDLER_LOADERS as any)[routing.module];
  if (!loader) {
    throw new Error(`Unknown handler module requested: ${routing.module}`);
  }

  const handlerModule = await loader();
  return { handlerModule, routing };
}
