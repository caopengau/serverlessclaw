import { randomBytes, randomUUID } from 'node:crypto';

/**
 * @module IdGenerator
 * @description Unified ID generation utilities with consistent entropy and collision handling.
 * Provides standardized ID generation for different entity types in the system.
 */

const FNV_1A_PRIME_32 = 0x01000193;
const FNV_1A_OFFSET_32 = 0x811c9dc5;

const PREFIX_MESSAGE = 'msg';
const PREFIX_SESSION = 'session';
const PREFIX_WORKSPACE = 'ws';
const PREFIX_GAP = 'gap';
const ENCODING_HEX = 'hex';
const DEFAULT_MESSAGE_TYPE = 'assistant';

/**
 * Generates a message ID with timestamp + entropy.
 * Format: msg-<type>-<timestamp>-<random>
 *
 * @param type - The type of message (e.g., 'user', 'assistant').
 * @returns A unique message identifier string.
 */
export function generateMessageId(type: string = DEFAULT_MESSAGE_TYPE): string {
  return `${PREFIX_MESSAGE}-${type}-${Date.now()}-${randomBytes(4).toString(ENCODING_HEX)}`;
}

/**
 * Generates a generic unique ID with timestamp + entropy.
 * Format: <prefix>-<timestamp>-<random>
 *
 * @param prefix - Optional prefix for the ID to categorize it.
 * @returns A unique identifier string.
 */
export function generateId(prefix?: string): string {
  const base = `${Date.now()}-${randomBytes(4).toString(ENCODING_HEX)}`;
  return prefix ? `${prefix}-${base}` : base;
}

/**
 * Generates a 32-bit FNV-1a hash for stable sort key generation.
 * Safely fits in JavaScript Number.MAX_SAFE_INTEGER to prevent DynamoDB errors.
 *
 * @param input - The string to hash.
 * @returns A numeric string representing the 32-bit hash.
 */
export function fnv1aHash(input: string): string {
  let hash = FNV_1A_OFFSET_32;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_1A_PRIME_32);
  }
  return (hash >>> 0).toString();
}

/**
 * Converts a session ID to a stable sort key for DynamoDB.
 * If the session ID contains a 13-digit timestamp, it uses that directly.
 *
 * @param sessionId - The session identifier to convert.
 * @returns A numeric sort key (timestamp or hash).
 */
export function sessionIdToSortKey(sessionId: string): number {
  const match = sessionId.match(/\d{13}/);
  if (match) {
    const parsedTimestamp = Number.parseInt(match[0], 10);
    if (!Number.isNaN(parsedTimestamp)) {
      return parsedTimestamp;
    }
  }
  return Number(fnv1aHash(sessionId));
}

/**
 * Generates a unique session identifier using UUID v4.
 *
 * @returns A unique session ID string.
 */
export function generateSessionId(): string {
  return `${PREFIX_SESSION}-${randomUUID()}`;
}

/**
 * Generates a unique workspace identifier with random entropy.
 *
 * @returns A unique workspace ID string.
 */
export function generateWorkspaceId(): string {
  return `${PREFIX_WORKSPACE}-${randomBytes(6).toString(ENCODING_HEX)}`;
}

/**
 * Generates a unique capability gap identifier with timestamp.
 *
 * @returns A unique gap ID string.
 */
export function generateGapId(): string {
  return `${PREFIX_GAP}-${Date.now()}-${randomBytes(3).toString(ENCODING_HEX)}`;
}
