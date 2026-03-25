/**
 * Trace types for ClawTracer instrumentation.
 */
export enum TraceType {
  LLM_CALL = 'llm_call',
  LLM_RESPONSE = 'llm_response',
  TOOL_CALL = 'tool_call',
  TOOL_RESPONSE = 'tool_result',
  REFLECT = 'reflect',
  EMIT = 'emit',
  BRIDGE = 'bridge',
  ERROR = 'error',
}

/**
 * Status values for traces.
 */
export enum TraceStatus {
  STARTED = 'started',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused',
}

/**
 * Optimization policies for system-wide reasoning depth.
 */
export enum OptimizationPolicy {
  AGGRESSIVE = 'aggressive',
  CONSERVATIVE = 'conservative',
  BALANCED = 'balanced',
}

/**
 * CodeBuild build states.
 */
export enum BuildStatus {
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  STOPPED = 'STOPPED',
  TIMED_OUT = 'TIMED_OUT',
  FAULT = 'FAULT',
  IN_PROGRESS = 'IN_PROGRESS',
}

/**
 * Parallel task completion status.
 */
export enum ParallelTaskStatus {
  SUCCESS = 'success',
  PARTIAL = 'partial',
  FAILED = 'failed',
}

/**
 * Health issue severity levels.
 */
export enum HealthSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}
