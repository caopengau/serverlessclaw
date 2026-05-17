/**
 * @module MemoryStatusAPI
 * Handlers for transitioning the status of capability gaps (e.g., OPEN -> PLANNED).
 */
import { z } from 'zod';
import { withApiHandler, validateBody } from '@/lib/api-handler';
import { GapStatus } from '@claw/core/lib/types/agent';

export const dynamic = 'force-dynamic';

const UpdateGapStatusSchema = z.object({
  gapId: z.string().min(1, 'gapId is required'),
  status: z.enum(['OPEN', 'PLANNED', 'PROGRESS', 'DEPLOYED', 'DONE', 'FAILED', 'ARCHIVED']),
});

/**
 * POST handler for updating the status of a capability gap.
 */
export const POST = withApiHandler(async (body, req) => {
  const { DynamoMemory } = await import('@claw/core/lib/memory');
  const { gapId, status } = validateBody(body, UpdateGapStatusSchema);

  const workspaceId =
    req.nextUrl.searchParams.get('workspaceId') || req.headers.get('x-workspace-id') || 'default';
  const memory = new DynamoMemory();
  await memory.updateGapStatus(gapId, status as GapStatus, { workspaceId });

  return { success: true, gapId, status };
});
