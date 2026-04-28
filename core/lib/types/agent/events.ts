import type { AgentPayloadInferred } from '../../schema/events';

/**
 * Standard system event types for communication between agents.
 */
export enum EventType {
  CODER_TASK = 'coder_task',
  CODER_TASK_COMPLETED = 'coder_task_completed',
  SYSTEM_BUILD_FAILED = 'system_build_failed',
  SYSTEM_BUILD_SUCCESS = 'system_build_success',
  MONITOR_BUILD = 'monitor_build',
  RECOVERY_LOG = 'recovery_log',
  EVOLUTION_PLAN = 'evolution_plan',
  REFLECT_TASK = 'reflect_task',
  OUTBOUND_MESSAGE = 'outbound_message',
  CONTINUATION_TASK = 'continuation_task',
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  SYSTEM_HEALTH_REPORT = 'system_health_report',
  CLARIFICATION_REQUEST = 'clarification_request',
  CLARIFICATION_TIMEOUT = 'clarification_timeout',
  SCHEDULE_TASK = 'schedule_task',
  HEARTBEAT_PROACTIVE = 'heartbeat_proactive',
  TASK_CANCELLED = 'task_cancelled',
  PARALLEL_TASK_DISPATCH = 'parallel_task_dispatch',
  PARALLEL_TASK_COMPLETED = 'parallel_task_completed',
  PARALLEL_BARRIER_TIMEOUT = 'parallel_barrier_timeout',
  DAG_TASK_COMPLETED = 'dag_task_completed',
  DAG_TASK_FAILED = 'dag_task_failed',
  CHUNK = 'chunk',

  // --- AG-UI Protocol Standard Events ---
  RUN_STARTED = 'RUN_STARTED',
  RUN_FINISHED = 'RUN_FINISHED',
  RUN_ERROR = 'RUN_ERROR',
  TEXT_MESSAGE_START = 'TEXT_MESSAGE_START',
  TEXT_MESSAGE_CONTENT = 'TEXT_MESSAGE_CONTENT',
  TEXT_MESSAGE_END = 'TEXT_MESSAGE_END',
  TOOL_CALL_START = 'TOOL_CALL_START',
  TOOL_CALL_ARGS = 'TOOL_CALL_ARGS',
  TOOL_CALL_END = 'TOOL_CALL_END',
  STATE_SNAPSHOT = 'STATE_SNAPSHOT',
  STATE_DELTA = 'STATE_DELTA',
  MESSAGES_SNAPSHOT = 'MESSAGES_SNAPSHOT',

  CRITIC_TASK = 'critic_task',
  REPUTATION_UPDATE = 'reputation_update',
  CONSENSUS_REQUEST = 'consensus_request',
  CONSENSUS_VOTE = 'consensus_vote',
  CONSENSUS_REACHED = 'consensus_reached',
  ESCALATION_LEVEL_TIMEOUT = 'escalation_level_timeout',
  ESCALATION_COMPLETED = 'escalation_completed',
  HANDOFF = 'handoff',
  HEALTH_ALERT = 'health_alert',
  COGNITIVE_HEALTH_CHECK = 'cognitive_health_check',
  RESEARCH_TASK = 'research_task',
  MERGER_TASK = 'merger_task',
  FACILITATOR_TASK = 'facilitator_task',
  QA_TASK = 'qa_task',
  COGNITION_REFLECTOR_TASK = 'cognition_reflector_task',
  STRATEGIC_PLANNER_TASK = 'strategic_planner_task',
  ORCHESTRATION_SIGNAL = 'orchestration_signal',
  STRATEGIC_TIE_BREAK = 'strategic_tie_break',
  REPORT_BACK = 'report_back',
  DELEGATION_TASK = 'delegation_task',
  SYSTEM_AUDIT_TRIGGER = 'system_audit_trigger',
  DASHBOARD_FAILURE_DETECTED = 'dashboard_failure_detected',
  DLQ_ROUTE = 'dlq_route',
  PULSE_PING = 'pulse_ping',
  PULSE_PONG = 'pulse_pong',
}

/**
 * Event source identifiers for tracking event origins.
 */
export enum EventSource {
  DASHBOARD = 'dashboard',
  TELEGRAM = 'telegram',
  API = 'api',
  SYSTEM = 'system',
  CODEBUILD = 'codebuild',
  SCHEDULER = 'scheduler',
  ORCHESTRATOR = 'orchestrator',
  WARMUP_MANAGER = 'warmup-manager',
  AGENT = 'agent',
  PARALLEL = 'parallel',
  SUPERCLAW = 'superclaw',
  AGENT_CRITIC = 'agent.critic',
  AGENT_RESEARCHER = 'agent.researcher',
  AGENT_FACILITATOR = 'agent.facilitator',
  BATCH_EVOLUTION = 'batch_evolution',
  HEARTBEAT_SCHEDULER = 'heartbeat.scheduler',
  CORE_RECOVERY = 'core.recovery',
  WEBHOOK = 'webhook',
  UNKNOWN = 'unknown',
}

/**
 * Event routing configuration for dynamic dispatch.
 */
export interface EventRoutingEntry {
  module: string;
  function: string;
  passContext?: boolean;
}

/**
 * Map of EventType identifiers to routing entries.
 */
export type EventRoutingTable = Record<string, EventRoutingEntry>;

/**
 * Shared EventBridge event structure for agent handlers.
 */
export interface AgentPayload extends AgentPayloadInferred {
  userId: string;
  traceId: string;
  sessionId: string;
  task: string;
  workspaceId?: string;
}

export interface AgentEvent {
  detail: AgentPayload;
  source: string;
}
