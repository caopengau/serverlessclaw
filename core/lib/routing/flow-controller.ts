import { ConfigManager } from '../registry/config';
import { DistributedState } from '../utils/distributed-state';
import { CONFIG_DEFAULTS } from '../config/config-defaults';

export interface FlowControlResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Centralized flow control for the system backbone.
 * Handles rate limiting, circuit breaking, and configuration caching.
 */
export class FlowController {
  /**
   * Checks if an event can proceed based on rate limits and circuit breaker state.
   */
  static async canProceed(eventType: string): Promise<FlowControlResult> {
    const [circuitThreshold, circuitTimeout, rateCapacity, rateRefill] = await Promise.all([
      ConfigManager.getTypedConfig(
        CONFIG_DEFAULTS.EVENT_CIRCUIT_THRESHOLD.configKey!,
        CONFIG_DEFAULTS.EVENT_CIRCUIT_THRESHOLD.code
      ),
      ConfigManager.getTypedConfig(
        CONFIG_DEFAULTS.EVENT_CIRCUIT_TIMEOUT_MS.configKey!,
        CONFIG_DEFAULTS.EVENT_CIRCUIT_TIMEOUT_MS.code
      ),
      ConfigManager.getTypedConfig(
        CONFIG_DEFAULTS.EVENT_RATE_BUCKET_CAPACITY.configKey!,
        CONFIG_DEFAULTS.EVENT_RATE_BUCKET_CAPACITY.code
      ),
      ConfigManager.getTypedConfig(
        CONFIG_DEFAULTS.EVENT_RATE_BUCKET_REFILL_MS.configKey!,
        CONFIG_DEFAULTS.EVENT_RATE_BUCKET_REFILL_MS.code
      ),
    ]);

    // 1. Rate Limiting check
    if (!(await DistributedState.consumeToken(eventType, rateCapacity, rateRefill))) {
      return { allowed: false, reason: 'Rate limit exceeded' };
    }

    // 2. Circuit Breaker check
    if (await DistributedState.isCircuitOpen(eventType, circuitThreshold, circuitTimeout)) {
      return { allowed: false, reason: 'Circuit breaker open' };
    }

    return { allowed: true };
  }

  /**
   * Records a failure for an event type.
   */
  static async recordFailure(eventType: string): Promise<void> {
    const circuitThreshold = await ConfigManager.getTypedConfig(
      CONFIG_DEFAULTS.EVENT_CIRCUIT_THRESHOLD.configKey!,
      CONFIG_DEFAULTS.EVENT_CIRCUIT_THRESHOLD.code
    );
    const circuitTimeout = await ConfigManager.getTypedConfig(
      CONFIG_DEFAULTS.EVENT_CIRCUIT_TIMEOUT_MS.configKey!,
      CONFIG_DEFAULTS.EVENT_CIRCUIT_TIMEOUT_MS.code
    );

    await DistributedState.recordFailure(eventType, circuitThreshold, circuitTimeout);
  }

  /**
   * Checks if trace summaries are enabled (for dashboard performance).
   */
  static async areTraceSummariesEnabled(): Promise<boolean> {
    return (
      (await ConfigManager.getTypedConfig('trace_summaries_enabled', false)) ||
      process.env.TRACE_SUMMARIES_ENABLED === 'true'
    );
  }
}
