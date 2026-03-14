import { DynamoMemory } from '../../lib/memory';
import { Agent } from '../../lib/agent';
import { ProviderManager } from '../../lib/providers/index';
import { getAgentTools } from '../../tools/index';
import { TraceSource, HealthReportEvent } from '../../lib/types/index';
import { sendOutboundMessage } from '../../lib/outbound';
import { logger } from '../../lib/logger';
import { Context } from 'aws-lambda';

const memory = new DynamoMemory();
const provider = new ProviderManager();

/**
 * Handles system health report events - triggers agent to investigate issues.
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
  } = eventDetail as unknown as HealthReportEvent;

  const triageTask = `SYSTEM HEALTH ALERT: A component has reported an internal issue.
    
    Component: ${component}
    Issue: ${issue}
    Severity: ${severity.toUpperCase()}
    
    Context:
    ${JSON.stringify(issueContext || {}, null, 2)}
    
    Please investigate this health issue. Determine if it requires a code modification (Coder Agent), configuration change, or if it can be resolved via an autonomous recovery action.
    Start by diagnosing the root cause using your tools.`;

  const { AgentRegistry } = await import('../../lib/registry');
  const config = await AgentRegistry.getAgentConfig('main');
  if (!config) {
    logger.error('Main agent config missing during health triage');
    return;
  }

  const agentTools = await getAgentTools('events');
  const agent = new Agent(memory, provider, agentTools, config.systemPrompt, config);
  const { responseText, attachments: resultAttachments } = await agent.process(
    userId,
    `HEALTH_TRIAGE: ${triageTask}`,
    {
      context,
      traceId,
      sessionId,
      source: TraceSource.SYSTEM,
    }
  );

  if (!responseText.startsWith('TASK_PAUSED')) {
    await sendOutboundMessage(
      'health-handler',
      userId,
      `🚨 **SYSTEM HEALTH ALERT** (${severity.toUpperCase()})\nComponent: ${component}\nIssue: ${issue}\n\nSuperClaw response: ${responseText}`,
      undefined,
      sessionId,
      'SuperClaw',
      resultAttachments
    );
  }
}
