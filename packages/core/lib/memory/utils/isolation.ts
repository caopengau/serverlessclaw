import { ContextualScope } from '../../types/index';

/**
 * Resolves the hierarchical scope identifier for query or storage.
 */
export function resolveScopeId(scope?: string | ContextualScope): string | undefined {
  return typeof scope === 'string' ? scope : scope?.workspaceId;
}

/**
 * Helper to apply workspace isolation (FilterExpression) to DynamoDB parameters.
 */
export function applyWorkspaceIsolation(
  params: Record<string, unknown>,
  scope?: string | import('../../types/memory').ContextualScope
): void {
  const workspaceId = typeof scope === 'string' ? scope : scope?.workspaceId;
  const orgId = typeof scope === 'string' ? undefined : scope?.orgId;

  // Check if userId is already in KeyConditionExpression to avoid DynamoDB error:
  // "Filter Expression can only contain non-primary key attributes"
  const isKeyQuery =
    (params.KeyConditionExpression as string | undefined)?.includes('userId') ||
    (params.KeyConditionExpression as string | undefined)?.includes('#uid') ||
    (params.KeyConditionExpression as string | undefined)?.includes('#userId') ||
    params.IndexName === 'UserInsightIndex';

  if (workspaceId) {
    // Only apply userId isolation if it's not a key-based query already
    const isolationExpr = isKeyQuery
      ? '(workspaceId = :workspaceId OR attribute_not_exists(workspaceId))'
      : '(workspaceId = :workspaceId OR attribute_not_exists(workspaceId)) AND (begins_with(userId, :pkPrefix) OR begins_with(userId, :globalPrefix))';

    params.FilterExpression = params.FilterExpression
      ? `(${params.FilterExpression as string}) AND (${isolationExpr})`
      : isolationExpr;

    params.ExpressionAttributeValues = {
      ...((params.ExpressionAttributeValues as Record<string, unknown>) || {}),
      ':workspaceId': workspaceId,
      ...(!isKeyQuery
        ? {
            ':pkPrefix': `WS#${workspaceId}#`,
            ':globalPrefix': 'SYSTEM#',
          }
        : {}),
    };
  } else if (orgId) {
    if (!isKeyQuery) {
      const isolationExpr = 'begins_with(userId, :orgPrefix)';
      params.FilterExpression = params.FilterExpression
        ? `(${params.FilterExpression as string}) AND (${isolationExpr})`
        : isolationExpr;

      params.ExpressionAttributeValues = {
        ...((params.ExpressionAttributeValues as Record<string, unknown>) || {}),
        ':orgPrefix': `ORG#ORG#${orgId}#`,
      };
    }
  } else {
    // Default global isolation
    if (!isKeyQuery) {
      const isolationExpr =
        'attribute_not_exists(workspaceId) AND NOT begins_with(userId, :orgPrefixMarker)';
      params.FilterExpression = params.FilterExpression
        ? `(${params.FilterExpression as string}) AND (${isolationExpr})`
        : isolationExpr;
      params.ExpressionAttributeValues = {
        ...((params.ExpressionAttributeValues as Record<string, unknown>) || {}),
        ':orgPrefixMarker': 'ORG#',
      };
    } else {
      // If it's a key query, we still want to ensure no workspace leak if not requested
      const isolationExpr = 'attribute_not_exists(workspaceId)';
      params.FilterExpression = params.FilterExpression
        ? `(${params.FilterExpression as string}) AND (${isolationExpr})`
        : isolationExpr;
    }
  }
}
