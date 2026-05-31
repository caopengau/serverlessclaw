import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Resource } from 'sst';

/**
 * Dispatches a coder_task event directly to EventBridge to trigger the Coder agent.
 * Bypasses the HITL council gate for dev/testing purposes.
 *
 * Usage: AWS_PROFILE=aiready sst shell --stage prod -- npx tsx scripts/dev/dispatch-coder-task.ts
 */

const PLAN = `
### Goal: Self-Evolution Health Monitor – PoC (gap_1780204632196)

**Context**: The system currently has no tool to check the self-evolution loop status or return health of core agents. This must be built.

**Objective**: Implement a \`GET /api/evolution-health\` endpoint in the dashboard that returns a canonical per-agent health JSON snapshot.

**Implementation Tasks**:
1. Create \`apps/dashboard/src/app/api/evolution-health/route.ts\`
   - Call \`listAgents\` tool to discover agents
   - Call \`pulseCheck\` per agent (max 3 retries, exponential backoff)
   - Return \`{ agents: [{id, status, lastPulse, latencyMs, error?}], healthy, unhealthy, timestamp }\`
   - Cache results for 30 seconds using in-memory LRU or \`unstable_cache\`
2. Add unit tests at \`apps/dashboard/src/app/api/evolution-health/route.test.ts\`
3. Update \`apps/dashboard/src/app/(dashboard)/pipeline/page.tsx\` or sidebar to include a "System Health" link

**Acceptance Criteria**:
- Single GET returns per-agent health for configured core agents within 500ms (cached)
- No permission escalations – read-only tools only (listAgents, pulseCheck, inspectTopology)
- Tests pass

**Gap ID**: gap_1780204632196
**Plan ID**: PLAN-1780204916341-8683f403
**Priority**: P1 (Impact 8/10, Urgency 8/10, Risk 3/10)
`.trim();

async function main() {
  // @ts-expect-error - sst resource typing
  const eventBusName: string = Resource.AgentBus.name;
  console.log(`📡 EventBus: ${eventBusName}`);

  const client = new EventBridgeClient({});

  const traceId = `trace-gap_1780204632196-fanout-PLAN-1780204916341-8683f403`;

  const payload = {
    userId: 'dashboard-user',
    task: PLAN,
    gapIds: ['gap_1780204632196'],
    planId: 'PLAN-1780204916341-8683f403',
    traceId,
    depth: 1,
    workspaceId: 'default',
    sessionId: `session-gap_1780204632196`,
    metadata: {
      gapIds: ['gap_1780204632196'],
      planId: 'PLAN-1780204916341-8683f403',
      isEvolutionTask: true,
    },
  };

  console.log('📤 Dispatching coder_task event to EventBridge...');
  console.log('   userId:', payload.userId);
  console.log('   traceId:', traceId);
  console.log('   gapId: gap_1780204632196');

  const command = new PutEventsCommand({
    Entries: [
      {
        EventBusName: eventBusName,
        Source: 'pipeline.evolution',
        DetailType: 'coder_task',
        Detail: JSON.stringify(payload),
      },
    ],
  });

  const result = await client.send(command);

  if (result.FailedEntryCount && result.FailedEntryCount > 0) {
    console.error('❌ Failed to put event:', result.Entries);
    process.exit(1);
  }

  console.log('✅ coder_task event dispatched!');
  console.log('   MessageId:', result.Entries?.[0]?.EventId);
  console.log('');
  console.log('📊 Monitor coder execution in AgentRunner logs:');
  console.log('   aws logs tail /aws/lambda/serverlessclaw-prod-AgentRunnerFunction-nfkkhrnt --follow');
}

main().catch((err) => {
  console.error('❌ Dispatch failed:', err);
  process.exit(1);
});
