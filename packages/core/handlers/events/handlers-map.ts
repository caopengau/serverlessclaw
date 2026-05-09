/**
 * Handler Loaders Map
 *
 * To optimize AI context budget and metabolic efficiency, we use a dynamic loader pattern.
 * This prevents the central multiplexer from transitively importing the entire handler
 * graph into its top-level context, which would exceed AI reasoning limits.
 */

export const HANDLER_LOADERS: Record<string, () => Promise<unknown>> = {
  './events/build-handler': () => import('./build-handler'),
  './events/continuation-handler': () => import('./continuation-handler'),
  './events/health-handler': () => import('./health-handler'),
  './events/task-result-handler': () => import('./task-result-handler'),
  './events/clarification-handler': () => import('./clarification-handler'),
  './events/clarification-timeout-handler': () => import('./clarification-timeout-handler'),
  './events/parallel-handler': () => import('./parallel-handler'),
  './events/parallel-barrier-timeout-handler': () => import('./parallel-barrier-timeout-handler'),
  './events/parallel-task-completed-handler': () => import('./parallel-task-completed-handler'),
  './events/dag-supervisor-handler': () => import('./dag-supervisor-handler'),
  './events/cancellation-handler': () => import('./cancellation-handler'),
  './events/proactive-handler': () => import('./proactive-handler'),
  './events/escalation-handler': () => import('./escalation-handler'),
  './events/consensus-handler': () => import('./consensus-handler'),
  './events/cognitive-health-handler': () => import('./cognitive-health-handler'),
  './events/strategic-tie-break-handler': () => import('./strategic-tie-break-handler'),
  './events/report-back-handler': () => import('./report-back-handler'),
  './events/audit-handler': () => import('./audit-handler'),
  './events/recovery-handler': () => import('./recovery-handler'),
  './events/dashboard-failure-handler': () => import('./dashboard-failure-handler'),
  './events/dlq-handler': () => import('./dlq-handler'),
  './events/reputation-handler': () => import('./reputation-handler'),
  './events/pulse-handler': () => import('./pulse-handler'),
};

/**
 * @deprecated Use HANDLER_LOADERS with await instead.
 * This is kept temporarily to prevent immediate build breakages if used elsewhere.
 */
export const STATIC_HANDLERS = HANDLER_LOADERS;
