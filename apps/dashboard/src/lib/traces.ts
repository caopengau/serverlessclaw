/* eslint-disable @typescript-eslint/no-explicit-any */
import { getResourceName } from '@/lib/sst-utils';
import { decodePaginationToken, encodePaginationToken } from '@/lib/pagination-utils';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { TraceSource } from '@claw/core/lib/types/index';
import { Trace } from '@/lib/types/ui';
import { logger } from '@claw/core/lib/logger';

/**
 * Fetches trace summaries from DynamoDB.
 */
export async function getTraces(
  nextToken?: string,
  options?: { startTime?: number; endTime?: number; workspaceId?: string },
  injectedDocClient?: any
): Promise<{ items: Trace[]; nextToken: string | undefined }> {
  try {
    const tableName = getResourceName('TraceTable');
    if (!tableName) {
      logger.warn('TraceTable name is missing from Resources and Environment');
      return { items: [], nextToken: undefined };
    }
    const client = new DynamoDBClient({});
    const docClient = injectedDocClient ?? DynamoDBDocumentClient.from(client);

    const { startTime, endTime, workspaceId } = options ?? {};

    let traceSummariesEnabled = false;
    try {
      const { ConfigManager } = await import('@claw/core/lib/registry/config');
      traceSummariesEnabled =
        (await ConfigManager.getTypedConfig('trace_summaries_enabled', false, { workspaceId })) ||
        process.env.TRACE_SUMMARIES_ENABLED === 'true';
    } catch (e) {
      logger.warn('Failed to load ConfigManager, checking env only:', e);
      traceSummariesEnabled = process.env.TRACE_SUMMARIES_ENABLED === 'true';
    }

    const primaryNodeId = traceSummariesEnabled ? '__summary__' : 'root';
    const fallbackNodeId = traceSummariesEnabled ? 'root' : '__summary__';

    // Use WorkspaceSummaryIndex if workspaceId is provided (Enterprise Scale)
    let indexName = 'SummaryByNode';
    let keyCondition = 'nodeId = :summary';
    const expressionAttributeValues: Record<string, any> = { ':summary': primaryNodeId };
    let filterExpression: string | undefined = undefined;
    const expressionAttributeNames: Record<string, string> = {};

    if (workspaceId) {
      indexName = 'WorkspaceSummaryIndex';
      keyCondition = 'workspaceId = :ws';
      expressionAttributeValues[':ws'] = workspaceId;
      filterExpression = 'nodeId = :summary';

      if (startTime || endTime) {
        if (startTime && endTime) {
          keyCondition += ' AND #ts BETWEEN :start AND :end';
          expressionAttributeValues[':start'] = startTime;
          expressionAttributeValues[':end'] = endTime;
        } else if (startTime) {
          keyCondition += ' AND #ts >= :start';
          expressionAttributeValues[':start'] = startTime;
        } else if (endTime) {
          keyCondition += ' AND #ts <= :end';
          expressionAttributeValues[':end'] = endTime;
        }
        expressionAttributeNames['#ts'] = 'timestamp';
      }
    } else {
      // Legacy / Global behavior
      if (startTime && endTime) {
        keyCondition += ' AND #ts BETWEEN :start AND :end';
        expressionAttributeValues[':start'] = startTime;
        expressionAttributeValues[':end'] = endTime;
      } else if (startTime) {
        keyCondition += ' AND #ts >= :start';
        expressionAttributeValues[':start'] = startTime;
      } else if (endTime) {
        keyCondition += ' AND #ts <= :end';
        expressionAttributeValues[':end'] = endTime;
      }
      if (startTime || endTime) expressionAttributeNames['#ts'] = 'timestamp';
    }

    const queryRes = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: indexName,
        KeyConditionExpression: keyCondition,
        FilterExpression: filterExpression,
        ExpressionAttributeNames:
          Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: 100,
        ExclusiveStartKey: decodePaginationToken(nextToken ?? ''),
        ScanIndexForward: false,
      })
    );

    const summaryItems = queryRes.Items ?? [];
    const allItems = summaryItems.sort((a: any, b: any) => {
      const bTs = Number(b.timestamp);
      const aTs = Number(a.timestamp);
      return (Number.isFinite(bTs) ? bTs : 0) - (Number.isFinite(aTs) ? aTs : 0);
    });

    const filteredSummary = allItems.filter(
      (item: any) => item.source !== TraceSource.SYSTEM
    ) as Trace[];

    // Fallback path: if trace summaries are disabled, primary rows won't exist.
    // In that case, query fallback trace nodes so /trace still has data.
    if (filteredSummary.length === 0) {
      logger.warn(
        `[getTraces] No ${primaryNodeId} rows found. Falling back to ${fallbackNodeId} trace query.`
      );

      // Re-use query logic but for fallbackNodeId
      const fallbackExpressionAttributeValues = {
        ...expressionAttributeValues,
        ':summary': fallbackNodeId,
      };

      const fallbackRes = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: indexName,
          KeyConditionExpression: keyCondition,
          FilterExpression: filterExpression,
          ExpressionAttributeNames:
            Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
          ExpressionAttributeValues: fallbackExpressionAttributeValues,
          Limit: 100,
          ExclusiveStartKey: decodePaginationToken(nextToken ?? ''),
          ScanIndexForward: false,
        })
      );

      const fallbackItems = (fallbackRes.Items ?? [])
        .filter((item: any) => item.source !== TraceSource.SYSTEM)
        .sort((a: any, b: any) => {
          const bTs = Number(b.timestamp);
          const aTs = Number(a.timestamp);
          return (Number.isFinite(bTs) ? bTs : 0) - (Number.isFinite(aTs) ? aTs : 0);
        }) as Trace[];

      return {
        items: fallbackItems,
        nextToken: encodePaginationToken(fallbackRes.LastEvaluatedKey),
      };
    }

    return {
      items: filteredSummary,
      nextToken: encodePaginationToken(queryRes.LastEvaluatedKey),
    };
  } catch (e) {
    logger.error('Error fetching traces:', e);
    return { items: [], nextToken: undefined };
  }
}
