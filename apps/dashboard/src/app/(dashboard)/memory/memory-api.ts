import { ScanCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export async function fetchMemoryItems(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  typeFilter: string,
  searchQuery: string,
  limit: number,
  exclusiveStartKey: Record<string, unknown> | null,
  workspaceId: string | null
) {
  const filterExpressions: string[] = [];
  const expressionAttributeValues: Record<string, unknown> = {};
  const expressionAttributeNames: Record<string, string> = {};

  if (typeFilter && typeFilter !== 'ALL') {
    filterExpressions.push('#type = :type');
    expressionAttributeValues[':type'] = typeFilter;
    expressionAttributeNames['#type'] = 'type';
  }

  if (searchQuery) {
    filterExpressions.push('contains(content, :query)');
    expressionAttributeValues[':query'] = searchQuery;
  }

  if (workspaceId) {
    filterExpressions.push('workspaceId = :workspaceId');
    expressionAttributeValues[':workspaceId'] = workspaceId;
  }

  const params: {
    TableName: string;
    Limit: number;
    ExclusiveStartKey?: Record<string, unknown>;
    FilterExpression?: string;
    ExpressionAttributeValues?: Record<string, unknown>;
    ExpressionAttributeNames?: Record<string, string>;
  } = {
    TableName: tableName,
    Limit: limit,
    ExclusiveStartKey: exclusiveStartKey || undefined,
  };

  if (filterExpressions.length > 0) {
    params.FilterExpression = filterExpressions.join(' AND ');
    params.ExpressionAttributeValues = expressionAttributeValues;
    if (Object.keys(expressionAttributeNames).length > 0) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }
  }

  const result = await docClient.send(new ScanCommand(params));
  return {
    items: result.Items || [],
    lastEvaluatedKey: result.LastEvaluatedKey,
  };
}
