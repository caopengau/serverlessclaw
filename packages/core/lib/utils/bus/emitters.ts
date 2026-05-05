import { PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { logger } from '../../logger';
import { BUS } from '../../constants';
import { getEventBridge, getBusName } from './client';
import { reserveIdempotencyKey, commitIdempotencyKey } from './idempotency';
import { storeInDLQ, purgeDlqEntry } from './dlq';
import { EventOptions, EventPriority, ErrorCategory, DlqEntry } from './types';

const MAX_RETRIES = BUS.MAX_RETRIES;
const INITIAL_BACKOFF_MS = BUS.INITIAL_BACKOFF_MS;

import { ErrorClass, classifyError } from '../error-classification';

function categorizeError(error: unknown): ErrorCategory {
  const ec = classifyError(error);
  if (ec === ErrorClass.TRANSIENT) return ErrorCategory.TRANSIENT;
  if (ec === ErrorClass.PERMANENT) return ErrorCategory.PERMANENT;
  return ErrorCategory.UNKNOWN;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Emits an event to the system bus with automatic retries and DLQ fallback.
 *
 * @param detailType - The type of event being emitted.
 * @param detail - The event payload.
 * @param options - Optional configuration for priority and idempotency.
 */
export async function emitEvent(
  detailType: string,
  detail: Record<string, unknown>,
  options: EventOptions = {}
): Promise<string> {
  const eb = getEventBridge();
  const busName = getBusName();
  const priority = options.priority ?? EventPriority.STANDARD;
  const idempotencyKey = options.idempotencyKey || (detail.idempotencyKey as string);

  if (idempotencyKey) {
    const isNew = await reserveIdempotencyKey(idempotencyKey);
    if (!isNew) {
      logger.debug(`Duplicate event suppressed: ${idempotencyKey}`);
      return 'SUPPRESSED';
    }
  }

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= MAX_RETRIES) {
    try {
      const command = new PutEventsCommand({
        Entries: [
          {
            Source: 'openclaw.system',
            DetailType: detailType,
            Detail: JSON.stringify({
              ...detail,
              ...(idempotencyKey ? { idempotencyKey } : {}),
              __priority: priority,
              __timestamp: Date.now(),
            }),
            EventBusName: busName,
          },
        ],
      });

      const response = await eb.send(command);

      if (response.FailedEntryCount && response.FailedEntryCount > 0) {
        throw new Error(response.Entries?.[0]?.ErrorMessage || 'EventBridge emission failed');
      }

      const eventId = response.Entries?.[0]?.EventId || 'unknown';

      if (idempotencyKey) {
        await commitIdempotencyKey(idempotencyKey, eventId);
      }

      return eventId;
    } catch (error) {
      lastError = error;
      const category = categorizeError(error);

      if (category === ErrorCategory.PERMANENT || attempt === MAX_RETRIES) {
        break;
      }

      attempt++;
      const backoff = INITIAL_BACKOFF_MS * 2 ** (attempt - 1);
      logger.warn(`Retrying event emission (${attempt}/${MAX_RETRIES}) in ${backoff}ms...`);
      await sleep(backoff);
    }
  }

  logger.error(`Failed to emit event after ${attempt} attempts. Storing in DLQ.`, lastError);

  await storeInDLQ({
    detailType,
    detail,
    priority,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });

  return 'QUEUED_IN_DLQ';
}

/**
 * Retries an event from the DLQ and removes it upon successful emission.
 * Mutates both the system bus (outbound) and the DLQ storage (deletion).
 *
 * @param entry - The DLQ entry to retry.
 * @returns True if successfully processed.
 */
export async function retryAndPurgeDlqEntry(entry: DlqEntry): Promise<boolean> {
  try {
    const result = await emitEvent(entry.detailType, entry.detail, {
      priority: entry.priority,
    });
    if (result !== 'QUEUED_IN_DLQ') {
      await purgeDlqEntry(entry.id);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Failed to retry DLQ entry ${entry.id}:`, error);
    return false;
  }
}

/** Legacy alias for retryAndPurgeDlqEntry */
export const retryDlqEntry = retryAndPurgeDlqEntry;

/**
 * Emits an event with a guaranteed idempotency key to prevent duplicate processing.
 *
 * @param detailType - The type of event.
 * @param detail - The payload.
 * @param idempotencyKey - Unique key for this event.
 * @param options - Optional priority.
 */
export async function emitEventWithIdempotency(
  detailType: string,
  detail: Record<string, unknown>,
  idempotencyKey: string,
  options: Omit<EventOptions, 'idempotencyKey'> = {}
): Promise<string> {
  return emitEvent(detailType, detail, { ...options, idempotencyKey });
}

/**
 * Emits an event with CRITICAL priority.
 */
export async function emitCriticalEvent(
  detailType: string,
  detail: Record<string, unknown>,
  options: Omit<EventOptions, 'priority'> = {}
): Promise<string> {
  return emitEvent(detailType, detail, { ...options, priority: EventPriority.CRITICAL });
}

/**
 * Emits an event with HIGH priority.
 */
export async function emitHighPriorityEvent(
  detailType: string,
  detail: Record<string, unknown>,
  options: Omit<EventOptions, 'priority'> = {}
): Promise<string> {
  return emitEvent(detailType, detail, { ...options, priority: EventPriority.HIGH });
}

/**
 * Emits an event with LOW priority.
 */
export async function emitLowPriorityEvent(
  detailType: string,
  detail: Record<string, unknown>,
  options: Omit<EventOptions, 'priority'> = {}
): Promise<string> {
  return emitEvent(detailType, detail, { ...options, priority: EventPriority.LOW });
}
