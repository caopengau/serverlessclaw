import { logger } from '../logger';

/**
 * Proactive Smart Warmup (Intent-Based)
 * Only trigger on first hop (depth === 0) and in serverless environments.
 * Returns immediately to avoid blocking the main execution path.
 */
export function triggerSmartWarmup(
  userText: string,
  depth: number,
  sessionId?: string,
  sessionStateManager?: { getState: (id: string) => unknown }
): void {
  if (depth === 0 && process.env.LAMBDA_TASK_ROOT) {
    import('../warmup/warmup-manager')
      .then(({ WarmupManager }) => {
        const serverArns = process.env.MCP_SERVER_ARNS
          ? JSON.parse(process.env.MCP_SERVER_ARNS)
          : {};
        const agentArns = process.env.AGENT_ARNS ? JSON.parse(process.env.AGENT_ARNS) : {};

        if (Object.keys(serverArns).length > 0 || Object.keys(agentArns).length > 0) {
          const warmup = new WarmupManager({
            servers: serverArns,
            agents: agentArns,
            ttlSeconds: 900,
          });
          warmup
            .smartWarmup({
              intent: userText,
              sessionState: sessionId ? sessionStateManager?.getState(sessionId) : undefined,
              warmedBy: 'webhook',
            })
            .catch((err) => logger.warn('[Warmup] Proactive trigger failed:', err));
        }
      })
      .catch((err) => logger.warn('[Warmup] Failed to load WarmupManager:', err));
  }
}
