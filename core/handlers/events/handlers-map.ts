import * as buildHandler from './build-handler';
import * as continuationHandler from './continuation-handler';
import * as healthHandler from './health-handler';
import * as taskResultHandler from './task-result-handler';
import * as clarificationHandler from './clarification-handler';
import * as clarificationTimeoutHandler from './clarification-timeout-handler';
import * as parallelHandler from './parallel-handler';
import * as parallelBarrierTimeoutHandler from './parallel-barrier-timeout-handler';
import * as parallelTaskCompletedHandler from './parallel-task-completed-handler';
import * as dagSupervisorHandler from './dag-supervisor-handler';
import * as cancellationHandler from './cancellation-handler';
import * as proactiveHandler from './proactive-handler';
import * as escalationHandler from './escalation-handler';
import * as consensusHandler from './consensus-handler';
import * as cognitiveHealthHandler from './cognitive-health-handler';
import * as strategicTieBreakHandler from './strategic-tie-break-handler';
import * as reportBackHandler from './report-back-handler';
import * as auditHandler from './audit-handler';
import * as recoveryHandler from './recovery-handler';
import * as dashboardFailureHandler from './dashboard-failure-handler';
import * as dlqHandler from './dlq-handler';
import * as reputationHandler from './reputation-handler';

export const STATIC_HANDLERS: Record<string, unknown> = {
  'build-handler': buildHandler,
  'continuation-handler': continuationHandler,
  'health-handler': healthHandler,
  'task-result-handler': taskResultHandler,
  'clarification-handler': clarificationHandler,
  'clarification-timeout-handler': clarificationTimeoutHandler,
  'parallel-handler': parallelHandler,
  'parallel-barrier-timeout-handler': parallelBarrierTimeoutHandler,
  'parallel-task-completed-handler': parallelTaskCompletedHandler,
  'dag-supervisor-handler': dagSupervisorHandler,
  'cancellation-handler': cancellationHandler,
  'proactive-handler': proactiveHandler,
  'escalation-handler': escalationHandler,
  'consensus-handler': consensusHandler,
  'cognitive-health-handler': cognitiveHealthHandler,
  'strategic-tie-break-handler': strategicTieBreakHandler,
  'report-back-handler': reportBackHandler,
  'audit-handler': auditHandler,
  'recovery-handler': recoveryHandler,
  'dashboard-failure-handler': dashboardFailureHandler,
  'dlq-handler': dlqHandler,
  'reputation-handler': reputationHandler,
};
