import { logger } from '../logger';
import { classifyError, calculateBackoff, ErrorClass } from './recovery/logic';

export { ErrorClass };

/**
 * Recovery strategy based on error class.
 */
export interface RecoveryStrategy {
  shouldRetry: boolean;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  useJitter: boolean;
  fallback?: () => Promise<unknown>;
}

/**
 * Result of a recovery attempt.
 */
export interface RecoveryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
}

const DEFAULT_STRATEGY: RecoveryStrategy = {
  shouldRetry: true,
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  useJitter: true,
};

/**
 * Enhanced error recovery manager.
 */
export class ErrorRecoveryManager {
  /**
   * Executes an operation with automatic retry and error classification.
   */
  static async withRecovery<T>(
    operation: () => Promise<T>,
    options: {
      component: string;
      strategy?: Partial<RecoveryStrategy>;
      onRetry?: (error: Error, attempt: number) => void;
      workspaceId?: string;
    }
  ): Promise<RecoveryResult<T>> {
    const strategy = { ...DEFAULT_STRATEGY, ...options.strategy };
    let attempt = 0;

    while (attempt <= strategy.maxRetries) {
      try {
        const result = await operation();
        return { success: true, result, attempts: attempt + 1 };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        const errorClass = classifyError(err);
        attempt++;

        if (
          !strategy.shouldRetry ||
          errorClass === ErrorClass.PERMANENT ||
          attempt > strategy.maxRetries
        ) {
          logger.error(`[RECOVERY] ${options.component} failed permanently: ${err.message}`);
          if (strategy.fallback) {
            try {
              const fallbackResult = await strategy.fallback();
              return { success: true, result: fallbackResult as T, attempts: attempt };
            } catch (fallbackErr) {
              logger.error(
                `[RECOVERY] Fallback also failed: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`
              );
            }
          }
          return { success: false, error: err, attempts: attempt };
        }

        const delay = calculateBackoff(
          attempt,
          strategy.baseDelayMs,
          strategy.maxDelayMs,
          strategy.useJitter
        );
        logger.warn(
          `[RECOVERY] ${options.component} transient failure, retrying in ${delay}ms (attempt ${attempt}): ${err.message}`
        );

        if (options.onRetry) options.onRetry(err, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return { success: false, attempts: attempt };
  }
}
