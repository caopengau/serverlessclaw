export const dynamic = 'force-dynamic';
import { GapStatus } from '@claw/core/lib/types';
import { revalidatePath } from 'next/cache';
import PipelineBoard from './PipelineBoard';
import EvolutionBudgetSection from './EvolutionBudgetSection';
import PlanView from './PlanView';
import { DynamoMemory } from '@claw/core/lib/memory';
import { GapItem } from '@claw/core/lib/types/memory';
import { deleteMemoryItem } from '@/lib/actions/dynamodb-actions';
import PageHeader from '@/components/PageHeader';
import { logger } from '@claw/core/lib/logger';

async function getGaps(): Promise<GapItem[]> {
  try {
    const memory = new DynamoMemory();
    const items = await memory.listByPrefix('GAP#');
    return ((items as unknown as GapItem[]) ?? []).sort((a, b) => {
      const aTs = typeof a.timestamp === 'string' ? parseInt(a.timestamp, 10) : (a.timestamp ?? 0);
      const bTs = typeof b.timestamp === 'string' ? parseInt(b.timestamp, 10) : (b.timestamp ?? 0);
      return bTs - aTs;
    });
  } catch (e) {
    logger.error('Error fetching gaps:', e);
    return [];
  }
}

async function updateStatus(gapId: string, status: string) {
  'use server';
  try {
    const { DynamoMemory } = await import('@claw/core/lib/memory');
    const memory = new DynamoMemory();
    await memory.updateGapStatus(gapId, status as GapStatus);
    revalidatePath('/pipeline');
  } catch (e) {
    logger.error('Error updating gap status:', e);
  }
}

async function pruneGap(gapId: string, timestamp: number | string) {
  'use server';
  try {
    await deleteMemoryItem(gapId, timestamp, '/pipeline');
  } catch (e) {
    logger.error('Error pruning gap:', e);
  }
}

async function triggerBatchEvolution(gapIds: string[]) {
  'use server';
  try {
    const { DynamoMemory } = await import('@claw/core/lib/memory');
    const { emitEvent } = await import('@claw/core/lib/utils/bus');

    const memory = new DynamoMemory();

    for (const gapId of gapIds) {
      const parts = gapId.split('#');
      if (parts.length < 2 || !parts[1]) {
        logger.warn(`Malformed gap ID: ${gapId}, skipping evolution.`);
        continue;
      }
      const numericId = parts[1];
      const plan = await memory.getDistilledMemory(`PLAN#${numericId}`);

      if (plan) {
        // Dispatch task to Coder
        await emitEvent('pipeline.dashboard', 'coder_task', {
          userId: 'SYSTEM#GLOBAL',
          task: plan,
          metadata: {
            gapIds: [gapId],
          },
          source: 'pipeline',
        });

        // Update status to PROGRESS
        await memory.updateGapStatus(gapId, GapStatus.PROGRESS);
      } else {
        logger.warn(`No plan found for gap ${gapId}, skipping evolution.`);
      }
    }

    revalidatePath('/pipeline');
  } catch (e) {
    logger.error('Error triggering batch evolution:', e);
  }
}

/** EvolutionPipeline — visual Kanban board for the gap lifecycle. Supports batch advancement and manual pruning. */
export default async function EvolutionPipeline() {
  const gaps = await getGaps();

  return (
    <main className="flex-1 flex flex-col min-h-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent">
      <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 min-w-[1240px] pb-32">
        <PageHeader
          titleKey="PIPELINE_TITLE"
          subtitleKey="PIPELINE_SUBTITLE"
          stats={
            <div className="flex gap-4">
              <div className="glass-card px-4 py-2 text-[10px] border-amber-500/20">
                <div className="text-white/50 mb-1 uppercase font-bold tracking-widest">
                  ACTIVE_GAPS
                </div>
                <div className="font-bold text-amber-500 text-lg">
                  {gaps.filter((g) => g.status !== GapStatus.DONE).length}
                </div>
              </div>
              <div className="glass-card px-4 py-2 text-[10px] border-cyber-green/20">
                <div className="text-white/50 mb-1 uppercase font-bold tracking-widest">
                  HISTORICAL_SUCCESS
                </div>
                <div className="font-bold text-cyber-green text-lg">
                  {gaps.filter((g) => g.status === GapStatus.DONE).length}
                </div>
              </div>
            </div>
          }
        />

        <EvolutionBudgetSection />

        <PipelineBoard
          initialGaps={gaps}
          updateStatus={updateStatus}
          pruneGap={pruneGap}
          triggerBatchEvolution={triggerBatchEvolution}
        />
      </div>

      <div className="fixed bottom-0 right-0 w-[700px] z-50 p-6 pointer-events-none">
        <div className="pointer-events-auto">
          <PlanView />
        </div>
      </div>
    </main>
  );
}
