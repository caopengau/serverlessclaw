import { logger } from '../../logger';
import { EVENT_SCHEMA_MAP } from '../../schema/events';

/**
 * Extract and normalize payload from EventBridge event.
 */
export function extractPayload<T extends object>(event: { detail?: T } | T): T {
  return (event as { detail?: T }).detail ?? (event as T);
}

/**
 * Validate required fields in agent payload.
 */
export function validatePayload(
  payload: Record<string, unknown> | null | undefined,
  requiredFields: string[]
): boolean {
  if (!payload) {
    logger.error('Invalid event payload: payload is null or undefined');
    return false;
  }
  for (const field of requiredFields) {
    if (payload[field] === undefined || payload[field] === null) {
      logger.error(`Invalid event payload: missing ${field}`);
      return false;
    }
  }
  return true;
}

/**
 * Validate an event payload against a registered schema.
 */
export function validateEventPayload<T extends object>(
  event: { detail?: T } | T,
  schemaKey: string
): T {
  const payload = extractPayload<T>(event);
  const schema = EVENT_SCHEMA_MAP[schemaKey as keyof typeof EVENT_SCHEMA_MAP];

  if (!schema) {
    logger.warn(`No schema found for key "${schemaKey}", falling back to basic extraction`);
    return payload;
  }

  try {
    return schema.parse(payload) as T;
  } catch (error) {
    logger.error(`Event validation failed for schema "${schemaKey}":`, error);
    throw new Error(
      `Event validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
