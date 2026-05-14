import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '@claw/core/lib/logger';
import { getMemoryTableName } from '@claw/core/lib/utils/ddb-client';
import { getUserId } from '@/lib/auth-utils';
import { HTTP_STATUS } from '@claw/core/lib/constants';

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

    const tableName = getMemoryTableName();

    if (!tableName) {
      return NextResponse.json({ activeDispatches: [] });
    }

    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);

    // Scan for active parallel dispatches - filtered by workspaceId
    const res = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression:
          'begins_with(userId, :prefix) AND #status = :pending AND workspaceId = :ws',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':prefix': 'PARALLEL#',
          ':pending': 'pending',
          ':ws': workspaceId,
        },
      })
    );

    const activeDispatches = (res.Items ?? []).map((item) => {
      // Extract task information from metadata
      const metadata = (item.metadata as Record<string, unknown>) ?? {};
      const tasks =
        (metadata.tasks as Array<{
          taskId: string;
          agentId: string;
          task: string;
          dependsOn?: string[];
        }>) ?? [];

      // Reconstruct DAG state if available
      const dagState = metadata.dagState as
        | {
            nodes: Record<
              string,
              {
                status: string;
                task: { taskId: string; agentId: string; task: string; dependsOn?: string[] };
              }
            >;
            completedTasks: string[];
            failedTasks: string[];
          }
        | undefined;

      // Map tasks with their current status
      const tasksWithStatus = tasks.map((task) => {
        const dagNode = dagState?.nodes[task.taskId];
        return {
          taskId: task.taskId,
          agentId: task.agentId,
          task: task.task,
          dependsOn: task.dependsOn,
          status: dagNode?.status ?? 'pending',
        };
      });

      // Trace ID extraction from potentially scoped key: PARALLEL#user#workspace#trace
      const userIdParts = item.userId?.split('#') ?? [];
      let traceId = 'unknown';
      if (userIdParts.length > 3) {
        // PARALLEL#user#workspace#trace
        traceId = userIdParts[3];
      } else if (userIdParts.length === 3) {
        // PARALLEL#user#trace (legacy or unscoped)
        traceId = userIdParts[2];
      } else if (userIdParts.length === 2) {
        // PARALLEL#trace
        traceId = userIdParts[1];
      }

      return {
        traceId,
        taskCount: item.taskCount as number,
        completedCount: item.completedCount as number,
        initiatorId: item.initiatorId as string,
        initialQuery: item.initialQuery as string | undefined,
        sessionId: item.sessionId as string | undefined,
        aggregationType: item.aggregationType as string | undefined,
        tasks: tasksWithStatus,
        dagState: dagState
          ? {
              nodes: dagState.nodes,
              completedTasks: dagState.completedTasks,
              failedTasks: dagState.failedTasks,
            }
          : undefined,
      };
    });

    return NextResponse.json({ activeDispatches });
  } catch (error) {
    logger.error('Error fetching collaboration data:', error);
    return NextResponse.json({ activeDispatches: [] });
  }
}
