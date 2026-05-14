import { logger } from '@claw/core/lib/logger';
import { getUserId } from '@/lib/auth-utils';
import { HTTP_STATUS } from '@claw/core/lib/constants';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface AgentHealthRecord {
  agentId: string;
  score: number;
  taskCompletionRate: number;
  reasoningCoherence: number;
  errorRate: number;
  memoryFragmentation: number;
  anomalies: unknown[];
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    const { searchParams } = new URL(req.url);
    const workspaceId =
      searchParams.get('workspaceId') || req.headers.get('x-workspace-id') || 'default';

    const { getIdentityManager, Permission } = await import('@claw/core/lib/session/identity');
    const identityManager = await getIdentityManager();

    // Verify workspace access
    const hasAccess = await identityManager.hasPermission(
      userId,
      Permission.AGENT_VIEW,
      workspaceId
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Unauthorized workspace access' },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    const { DynamoMemory } = await import('@claw/core/lib/memory');
    const memory = new DynamoMemory();
    // Use scoped prefix
    const items = await memory.listByPrefix(`WS#${workspaceId}#HEALTH#`);

    if (!items || items.length === 0) {
      return NextResponse.json({ agents: [], message: 'No health data recorded' });
    }

    const agents: AgentHealthRecord[] = items
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as Record<string, unknown>).overallScore === 'number'
      )
      .map((item) => {
        const record = item as Record<string, unknown>;
        const rawUserId = (record.userId as string) ?? '';
        // Handle both scoped and unscoped IDs for robustness
        let agentId = rawUserId;
        if (rawUserId.includes('HEALTH#METRIC#')) {
          agentId = rawUserId.split('HEALTH#METRIC#').pop() || 'unknown';
        } else if (rawUserId.includes('HEALTH#')) {
          agentId = rawUserId.split('HEALTH#').pop() || 'unknown';
        }

        return {
          agentId: agentId || 'unknown',
          score: typeof record.overallScore === 'number' ? record.overallScore : 0,
          taskCompletionRate:
            typeof record.taskCompletionRate === 'number' ? record.taskCompletionRate : 0,
          reasoningCoherence:
            typeof record.reasoningCoherence === 'number' ? record.reasoningCoherence : 0,
          errorRate: typeof record.errorRate === 'number' ? record.errorRate : 0,
          memoryFragmentation:
            typeof record.memoryFragmentation === 'number' ? record.memoryFragmentation : 0,
          anomalies: Array.isArray(record.anomalies) ? record.anomalies : [],
        };
      });

    return NextResponse.json({ agents });
  } catch (e) {
    logger.error('Error fetching cognitive health:', e);
    return NextResponse.json(
      { agents: [], error: 'Failed to fetch health data' },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
