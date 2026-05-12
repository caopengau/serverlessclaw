import React from 'react';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '@claw/core/lib/logger';
import { getTraceTableName } from '@claw/core/lib/utils/ddb-client';
import { Trace } from '@/lib/types/ui';

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
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const nodes = await getTraceNodes(id);

  return <TraceDetailView id={id} nodes={nodes} />;
}
