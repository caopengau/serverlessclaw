/**
 * @module PrioritizeAPI
 * API for manually adjusting the impact, urgency, and priority of identified system gaps.
 */
import { z } from 'zod';
import { withApiHandler, validateBody, ApiError } from '@/lib/api-handler';
import { DynamoMemory } from '@claw/core/lib/memory';
import { getUserId } from '@/lib/auth-utils';
import { HTTP_STATUS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const PrioritizeSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  timestamp: z.number().int().positive('timestamp must be a positive integer'),
  priority: z.number().int().min(0).max(10).optional(),
  urgency: z.number().int().min(0).max(10).optional(),
  impact: z.number().int().min(0).max(10).optional(),
});

/**
 * POST handler for prioritizing memory insights.
 */
export const POST = withApiHandler(async (body, req) => {
  const currentUserId = getUserId(req);
  const { userId, timestamp, priority, urgency, impact } = validateBody(body, PrioritizeSchema);

  const workspaceId =
    req.nextUrl.searchParams.get('workspaceId') || req.headers.get('x-workspace-id') || 'default';

  const { getIdentityManager, Permission } = await import('@claw/core/lib/session/identity');
  const identityManager = await getIdentityManager();

  // Verify workspace access (Principle 11)
  const hasAccess = await identityManager.hasPermission(
    currentUserId,
    Permission.AGENT_UPDATE,
    workspaceId
  );
  if (!hasAccess) {
    throw new ApiError('Unauthorized workspace access', HTTP_STATUS.FORBIDDEN);
  }

  const memory = new DynamoMemory();

  await memory.updateInsightMetadata(
    userId,
    timestamp,
    {
      priority,
      urgency,
      impact,
    },
    { workspaceId }
  );

  return { success: true };
});
