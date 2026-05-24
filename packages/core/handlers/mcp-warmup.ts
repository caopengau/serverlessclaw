import type { Handler, Context } from 'aws-lambda';
import { logger } from '../lib/logger';
import { WarmupManager } from '../lib/warmup';

interface WarmupEvent {
  servers?: string[];
}

/**
 * MCP Warmup Handler
 * Uses WarmupManager to warm MCP servers with state tracking.
 *
 * Primary warmup is activity-based: the webhook handler triggers smartWarmup on
 * every incoming human message using intent detection (lib/warmup).
 * This handler is retained as a manual/on-demand invocation target only
 * (e.g. after a cold deploy or recovery). It is NOT scheduled.
 */
export const handler: Handler = async (event: WarmupEvent, _context: Context) => {
  const serverArns: Record<string, string> = JSON.parse(process.env.MCP_SERVER_ARNS ?? '{}');
  const serversToWarm = event.servers ?? Object.keys(serverArns);

  logger.info('MCP Warmup started', {
    serversToWarm,
    totalServers: Object.keys(serverArns).length,
  });

  if (serversToWarm.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({ total: 0, success: 0, failed: 0, skipped: 0 }),
    };
  }

  const warmupManager = new WarmupManager({
    servers: serverArns,
    agents: {},
    ttlSeconds: 900,
  });

  const result = await warmupManager.smartWarmup({
    servers: serversToWarm,
    warmedBy: 'scheduler',
  });

  const alreadyWarmCount = serversToWarm.filter((s) => !result.servers.includes(s)).length;
  const failedCount = serversToWarm.length - result.servers.length - alreadyWarmCount;

  const summary = {
    total: serversToWarm.length,
    success: result.servers.length,
    failed: Math.max(0, failedCount),
    skipped: alreadyWarmCount,
  };

  logger.info('MCP Warmup completed', summary);

  return {
    statusCode: 200,
    body: JSON.stringify(summary),
  };
};
