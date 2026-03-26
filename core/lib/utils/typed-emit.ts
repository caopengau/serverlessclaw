import { EventType } from '../types/index';
import { logger } from '../logger';
import {
  EVENT_SCHEMA_MAP,
  SchemaEventType,
  CompletionEventPayload,
  FailureEventPayload,
  OutboundMessageEventPayload,
  HealthReportEventPayload,
  ProactiveHeartbeatPayload,
} from '../schema/events';
import { emitEvent, EventOptions } from './bus';

/**
 * Validates and emits an event to the AgentBus with full structural enforcement.
 * Throws an error if the detail does not match the schema for the given type.
 *
 * @param source - The originating component name.
 * @param type - The EventType (must exist in EVENT_SCHEMA_MAP).
 * @param detail - The event payload to validate and send.
 * @param options - Optional emission controls (priority, retries, etc).
 */
export async function emitTypedEvent<T extends SchemaEventType>(
  source: string,
  type: T,
  detail: unknown,
  options: EventOptions = {}
): Promise<{ success: boolean; eventId?: string; reason?: string }> {
  const schema = EVENT_SCHEMA_MAP[type];

  if (!schema) {
    const errorMsg = `No schema found for event type: ${type}. Emission blocked for safety.`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    // Structural Enforcement at the point of origin
    const validatedDetail = schema.parse(detail);

    return await emitEvent(source, type, validatedDetail as Record<string, unknown>, options);
  } catch (error) {
    logger.error(`Validation failed for ${type} from ${source}:`, error);
    throw error;
  }
}

/**
 * Validates and emits an event, but falls back to logging a warning instead of throwing
 * on validation failure. Use this for non-critical logging events.
 */
export async function emitTypedEventSafe<T extends SchemaEventType>(
  source: string,
  type: T,
  detail: unknown,
  options: EventOptions = {}
): Promise<{ success: boolean; eventId?: string; reason?: string }> {
  try {
    return await emitTypedEvent(source, type, detail, options);
  } catch (error) {
    logger.warn(`Safe emit failed validation for ${type}, sending raw anyway:`, error);
    return await emitEvent(source, type, detail as Record<string, unknown>, options);
  }
}

/** Helper: Emit Task Completed event. */
export const emitTaskCompleted = (
  source: string,
  detail: Partial<CompletionEventPayload>,
  opts?: EventOptions
) => emitTypedEvent(source, EventType.TASK_COMPLETED as unknown as SchemaEventType, detail, opts);

/** Helper: Emit Task Failed event. */
export const emitTaskFailed = (
  source: string,
  detail: Partial<FailureEventPayload>,
  opts?: EventOptions
) => emitTypedEvent(source, EventType.TASK_FAILED as unknown as SchemaEventType, detail, opts);

/** Helper: Emit Outbound Message event. */
export const emitOutboundMessage = (
  source: string,
  detail: Partial<OutboundMessageEventPayload>,
  opts?: EventOptions
) => emitTypedEvent(source, EventType.OUTBOUND_MESSAGE as unknown as SchemaEventType, detail, opts);

/** Helper: Emit Health Report event. */
export const emitHealthReport = (
  source: string,
  detail: Partial<HealthReportEventPayload>,
  opts?: EventOptions
) =>
  emitTypedEvent(
    source,
    EventType.SYSTEM_HEALTH_REPORT as unknown as SchemaEventType,
    detail,
    opts
  );

/** Helper: Emit Proactive Heartbeat event. */
export const emitProactiveHeartbeat = (
  source: string,
  detail: Partial<ProactiveHeartbeatPayload>,
  opts?: EventOptions
) =>
  emitTypedEvent(source, EventType.HEARTBEAT_PROACTIVE as unknown as SchemaEventType, detail, opts);
