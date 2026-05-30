import { emitEvent } from '../../packages/core/lib/utils/bus/emitters';
import { EventType } from '../../packages/core/lib/types/agent';

async function main() {
  const gapId = process.argv[2];
  if (!gapId) {
    console.error('Usage: npx tsx scripts/dev/trigger-prod-planner.ts <gapId>');
    process.exit(1);
  }

  console.log(`🚀 Dispatching STRATEGIC_PLANNER_TASK for gap: ${gapId}...`);

  const result = await emitEvent('user', EventType.STRATEGIC_PLANNER_TASK, {
    userId: 'dashboard-user',
    traceId: `trace-${gapId}`,
    sessionId: `session-${gapId}`,
    task: 'I wish I had a tool to check if the self-evolution loop is active and return the health status of all core agents. Currently, I have to inspect them manually.',
    gapId: gapId,
    workspaceId: 'default',
    userRole: 'admin',
  });

  console.log('Result:', result);
}

main().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
