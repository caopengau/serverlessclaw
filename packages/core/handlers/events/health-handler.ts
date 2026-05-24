import { HEALTH_REPORT_EVENT_SCHEMA } from '../../lib/schema/events';
import { AGENT_TYPES, UserRole } from '../../lib/types/agent';
import { HealthSeverity } from '../../lib/types/constants';
import { Context } from 'aws-lambda';
import { processEventWithAgent } from './shared';
import { logger } from '../../lib/logger';

/**
 * Handles system health report events.
 *
 * Severity gate — only run the full LLM triage agent for HIGH/CRITICAL reports.
 * LOW and MEDIUM reports are logged to CloudWatch only to avoid unnecessary LLM
 * invocations and user notification spam.
 *
 * @param eventDetail - The health report event detail.
 * @param context - The AWS Lambda context.
 * @returns A promise resolving when the health report is processed.
 */
export async function handleHealthReport(
  eventDetail: Record<string, unknown>,
  context: Context
): Promise<void> {
  const {
    component,
    issue,
    severity,
    context: issueContext,
    userId,
    traceId,
    sessionId,
    workspaceId,
    teamId,
    staffId,
    userRole,
  } = HEALTH_REPORT_EVENT_SCHEMA.parse(eventDetail);

  // LOW/MEDIUM: log only — do NOT run LLM agent or notify user.
  // Prevents free-tier bleed and alert fatigue from transient DynamoDB/infra hiccups.
  if (severity === HealthSeverity.LOW || severity === HealthSeverity.MEDIUM) {
    logger.warn(
      `[HealthHandler] Suppressed non-critical health report (${severity}): [${component}] ${issue}`
    );
    return;
  }

  const triageTask = `SYSTEM HEALTH ALERT: A component has reported an internal issue.
    
    Component: ${component}
    Issue: ${issue}
    Severity: ${severity.toUpperCase()}
    
    Context:
    ${JSON.stringify(issueContext ?? {}, null, 2)}
    
    Please investigate this health issue. Determine if it requires a code modification (Coder Agent), configuration change, or if it can be resolved via an autonomous recovery action.
    Start by diagnosing the root cause using your tools.`;

  await processEventWithAgent(userId, AGENT_TYPES.SUPERCLAW, triageTask, {
    context,
    traceId,
    sessionId,
    handlerTitle: 'HEALTH_TRIAGE',
    outboundHandlerName: 'health-handler',
    formatResponse: (responseText) =>
      `🚨 **SYSTEM HEALTH ALERT** (${severity.toUpperCase()})
Component: ${component}
Issue: ${issue}

SuperClaw response: ${responseText}`,
    workspaceId,
    teamId,
    staffId,
    userRole: userRole as UserRole,
  });
}
