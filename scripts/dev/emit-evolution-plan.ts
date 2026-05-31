/**
 * Dev script: Emits an evolution_plan event to the SQS FIFO PlannerQueue.
 * This triggers the strategic planner to process the seeded capability gap.
 *
 * Usage: sst shell --stage prod -- npx tsx scripts/dev/emit-evolution-plan.ts
 */
import { emitEvent } from '../../packages/core/lib/utils/bus/emitters';
import { EventType } from '../../packages/core/lib/types/agent/events';

async function main() {
  const gapId = process.env.GAP_ID ?? '1780219991962';
  const task =
    process.env.GAP_TASK ??
    'Implement capability: I wish I had a tool to check if the self-evolution loop is active and return the health status of all core agents. Currently, I have to inspect them manually.';

  console.log(`Emitting evolution_plan for gap ${gapId} to PlannerQueue...`);

  await emitEvent('pipeline.evolution', EventType.EVOLUTION_PLAN, {
    userId: 'SYSTEM',
    sessionId: 'session-spine-evolution',
    traceId: `trace-manual-evolution-${Date.now()}`,
    workspaceId: 'default',
    agentId: 'strategic-planner',
    task,
    userRole: 'member',
    gapId,
    metadata: {
      gapIds: [gapId],
      source: 'manual-trigger',
    },
  });

  console.log('evolution_plan emitted successfully → strategic planner will pick it up from PlannerQueue');
}

main().catch((err) => {
  console.error('Failed to emit evolution_plan:', err);
  process.exit(1);
});
