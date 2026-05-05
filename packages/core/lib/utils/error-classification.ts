/**
 * Error classification for determining recovery strategy.
 */
export enum ErrorClass {
  TRANSIENT = 'transient',
  PERMANENT = 'permanent',
  UNKNOWN = 'unknown',
}

/**
 * Classifies an error into transient, permanent, or unknown.
 */
export function classifyError(error: unknown): ErrorClass {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  
  const transientPatterns = [
    'rate limit',
    'too many requests',
    'timeout',
    'deadline exceeded',
    'socket',
    'connection',
    'econnreset',
    'etimedout',
    'throttling',
    '500',
    '503',
    'service unavailable',
    'temporary',
    'internal error',
  ];

  const permanentPatterns = [
    'invalid',
    'unauthorized',
    'forbidden',
    'not found',
    'malformed',
    'missing required',
    'bad request',
    '400',
    '401',
    '403',
    '404',
    'access denied',
  ];

  if (transientPatterns.some((p) => message.includes(p))) return ErrorClass.TRANSIENT;
  if (permanentPatterns.some((p) => message.includes(p))) return ErrorClass.PERMANENT;

  return ErrorClass.UNKNOWN;
}

/**
 * Calculates exponential backoff with optional jitter.
 */
export function calculateBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  useJitter: boolean = true
): number {
  const exp = Math.min(attempt, 10);
  let delay = Math.min(baseDelayMs * Math.pow(2, exp), maxDelayMs);

  if (useJitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }

  return Math.round(delay);
}
