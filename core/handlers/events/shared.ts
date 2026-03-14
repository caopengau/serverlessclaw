import { EventType, CompletionEvent, FailureEvent } from '../../lib/types/index';
import { sendOutboundMessage } from '../../lib/outbound';
import { logger } from '../../lib/logger';
import { SYSTEM, DYNAMO_KEYS } from '../../lib/constants';
import { ConfigManager } from '../../lib/registry/config';
import { emitEvent } from '../../lib/utils/bus';

/**
 * Wake up the initiator agent when a delegated task or system event completes.
 */
export async function wakeupInitiator(
  userId: string,
  initiatorId: string | undefined,
  task: string,
  traceId: string | undefined,
  sessionId: string | undefined,
  depth: number = 0
): Promise<void> {
  if (!initiatorId || !task) return;

  const initiatorAgentId = initiatorId.endsWith('.agent')
    ? initiatorId.replace('.agent', '')
    : initiatorId;

  await emitEvent('events.handler', EventType.CONTINUATION_TASK, {
    userId,
    agentId: initiatorAgentId,
    task,
    traceId,
    initiatorId,
    sessionId,
    depth: depth + 1,
  });
}

/**
 * Get the recursion limit from config or use default.
 */
export async function getRecursionLimit(): Promise<number> {
  let RECURSION_LIMIT: number = SYSTEM.DEFAULT_RECURSION_LIMIT;
  try {
    const customLimit = await ConfigManager.getRawConfig(DYNAMO_KEYS.RECURSION_LIMIT);
    if (customLimit !== undefined) {
      RECURSION_LIMIT = parseInt(String(customLimit), 10);
    }
  } catch {
    logger.warn('Failed to fetch recursion_limit from DDB, using default.');
  }
  return RECURSION_LIMIT;
}

/**
 * Handle recursion limit exceeded scenario.
 */
export async function handleRecursionLimitExceeded(
  userId: string,
  sessionId: string | undefined,
  handlerName: string,
  reason: string
): Promise<void> {
  await sendOutboundMessage(
    handlerName,
    userId,
    `⚠️ **Recursion Limit Exceeded**\n\n${reason}`,
    undefined,
    sessionId,
    'SuperClaw',
    undefined
  );
}

export { EventType, CompletionEvent, FailureEvent, sendOutboundMessage, logger };
