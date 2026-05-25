import React from 'react';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '@claw/core/lib/logger';
import { getTraceTableName } from '@claw/core/lib/utils/ddb-client';
import { Trace } from '@/lib/types/ui';
import { redirect } from 'next/navigation';
import { AUTH } from '@/lib/constants';

import TraceDetailView from './TraceDetailView';

export const dynamic = 'force-dynamic';

/**
 * Fetches all nodes for a specific trace record from DynamoDB
 */
async function getTraceNodes(traceId: string): Promise<Trace[]> {
  try {
    const tableName = getTraceTableName();
    if (!tableName) {
      logger.error('TraceTable name is missing from Resources');
      return [];
    }
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });

    const { Items } = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'traceId = :tid',
        ExpressionAttributeValues: { ':tid': traceId },
      })
    );

    return (Items as Trace[]) ?? [];
  } catch (e) {
    logger.error('Error fetching trace nodes:', e);
    return [];
  }
}

/**
 * Detailed view of a single execution trace
 */
export default async function TraceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ workspaceId?: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const sParams = await searchParams;

  const { cookies: getCookies } = await import('next/headers');
  const cookieStore = await getCookies();
  const userId = cookieStore.get(AUTH.SESSION_USER_ID)?.value || 'dashboard-user';

  const { getIdentityManager, Permission } = await import('@claw/core/lib/session/identity');
  const identityManager = await getIdentityManager();

  const workspaceId = sParams.workspaceId || 'default';
  const hasAccess = await identityManager.hasPermission(userId, Permission.AGENT_VIEW, workspaceId);

  if (!hasAccess) {
    redirect('/unauthorized');
  }

  const nodes = await getTraceNodes(id);

  return <TraceDetailView id={id} nodes={nodes} />;
}
