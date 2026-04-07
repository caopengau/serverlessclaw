import { logger } from '../../lib/logger';
import { emitEvent, EventPriority } from '../../lib/utils/bus';
import { EventType } from '../../lib/types/agent';

interface StrategicTieBreakPayload {
  userId: string;
  agentId: string;
  task: string;
  originalTask: string;
  question: string;
  traceId: string;
  initiatorId: string;
  sessionId?: string;
  depth?: number;
}

/**
 * P1 Fix: Improved strategic tie-break logic.
 * Makes actual strategic decisions based on task risk assessment.
 * - If original task is high-risk, defer execution with safety warning
 * - If task contains SAFE_MODE flag, respect it and add constraints
 * - Otherwise, proceed with conservative assumptions
 */
export async function handleStrategicTieBreak(eventDetail: Record<string, unknown>): Promise<void> {
  const { userId, agentId, task, originalTask, traceId, initiatorId, sessionId, depth } =
    eventDetail as unknown as StrategicTieBreakPayload;

  logger.warn(`[TIE_BREAK] Performing strategic tie-break for ${agentId} | traceId: ${traceId}`);

  // P1 Fix: Analyze original task for high-risk operations and apply strategic handling
  const highRiskPatterns = [
    /delete/i,
    /drop\s+(table|database|index)/i,
    /truncate/i,
    /force\s+push/i,
    /rm\s+-rf/i,
    /shutdown/i,
    /terminate/i,
    /kill\s+(all|process)/i,
  ];

  const isHighRisk = highRiskPatterns.some((pattern) => pattern.test(originalTask));

  let finalTask: string;
  let eventType: string;

  if (isHighRisk) {
    // High-risk operation detected - defer instead of executing
    logger.warn(`[TIE_BREAK] High-risk operation detected in task. Deferring execution.`);
    finalTask = `STRATEGIC_TIE_BREAK (DEFERRED): The original task contained high-risk operations that require explicit human approval. Task: "${originalTask}". Please create a deferred task requiring human confirmation before proceeding.`;
    eventType = EventType.CLARIFICATION_REQUEST;
  } else if (task.includes('SAFE_MODE') || task.includes('avoid.*high.*risk')) {
    // Task already has safety instructions - proceed with conservative constraints
    finalTask = `${task}\n\n---\n**STRATEGIC CONSTRAINTS APPLIED:**\n- No destructive operations\n- Prefer read-only or low-impact alternatives\n- Log all changes for audit\n- Request clarification if uncertain`;
    eventType = `${agentId}_task`;
  } else {
    // Default: proceed with safe assumptions
    finalTask = task;
    eventType = `${agentId}_task`;
  }

  await emitEvent(
    'strategic-tie-break-handler',
    eventType,
    {
      userId,
      agentId,
      task: finalTask,
      originalTask,
      traceId,
      initiatorId,
      sessionId,
      depth,
      isContinuation: true,
      strategicDecision: isHighRisk ? 'DEFERRED' : 'PROCEED_SAFE',
    },
    { priority: EventPriority.HIGH }
  );

  logger.info(
    `[TIE_BREAK] Dispatched strategic tie-break (${isHighRisk ? 'DEFERRED' : 'PROCEED_SAFE'}) to ${agentId}`
  );
}
