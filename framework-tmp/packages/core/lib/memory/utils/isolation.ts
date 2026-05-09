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

  if (workspaceId) {
    const isolationExpr =
      '(workspaceId = :workspaceId OR attribute_not_exists(workspaceId)) AND (begins_with(userId, :pkPrefix) OR begins_with(userId, :globalPrefix))';
    params.FilterExpression = params.FilterExpression
      ? `(${params.FilterExpression as string}) AND (${isolationExpr})`
      : isolationExpr;

    params.ExpressionAttributeValues = {
      ...((params.ExpressionAttributeValues as Record<string, unknown>) || {}),
      ':workspaceId': workspaceId,
      ':pkPrefix': `WS#${workspaceId}#`,
      ':globalPrefix': 'SYSTEM#',
    };
  } else if (orgId) {
    const isolationExpr = 'begins_with(userId, :orgPrefix)';
    params.FilterExpression = params.FilterExpression
      ? `(${params.FilterExpression as string}) AND (${isolationExpr})`
      : isolationExpr;

    params.ExpressionAttributeValues = {
      ...((params.ExpressionAttributeValues as Record<string, unknown>) || {}),
      ':orgPrefix': `ORG#ORG#${orgId}#`,
    };
  } else {
    const isolationExpr =
      'attribute_not_exists(workspaceId) AND NOT begins_with(userId, :orgPrefixMarker)';
    params.FilterExpression = params.FilterExpression
      ? `(${params.FilterExpression as string}) AND (${isolationExpr})`
      : isolationExpr;
    params.ExpressionAttributeValues = {
      ...((params.ExpressionAttributeValues as Record<string, unknown>) || {}),
      ':orgPrefixMarker': 'ORG#',
    };
  }
}
