import { UserRole } from '../../types/agent';
import { logger } from '../../logger';

/**
 * Maps UserRoles to AWS-aligned permission scopes.
 * This can be used to generate dynamic IAM policies or session tags.
 */
export const ROLE_IAM_MAPPING: Record<UserRole, string[]> = {
  [UserRole.OWNER]: ['*'], // Full access within tenant
  [UserRole.ADMIN]: [
    's3:*',
    'dynamodb:*',
    'lambda:InvokeFunction',
    'eventbridge:PutEvents',
    'iam:GetUser',
    'iam:GetRole',
  ],
  [UserRole.MEMBER]: [
    's3:GetObject',
    's3:PutObject',
    's3:ListBucket',
    'dynamodb:GetItem',
    'dynamodb:PutItem',
    'dynamodb:Query',
    'lambda:InvokeFunction',
    'eventbridge:PutEvents',
  ],
  [UserRole.VIEWER]: ['s3:GetObject', 's3:ListBucket', 'dynamodb:GetItem', 'dynamodb:Query'],
};

/**
 * Generates an inline IAM policy for a specific user and tenant.
 * Used for ABAC (Attribute-Based Access Control) enforcement.
 */
export function generateTenantPolicy(
  orgId: string,
  _workspaceId: string,
  role: UserRole
): Record<string, any> {
  const permissions = ROLE_IAM_MAPPING[role] || ROLE_IAM_MAPPING[UserRole.VIEWER];

  // Base policy: Allow actions only on resources tagged with the orgId
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: permissions,
        Resource: '*',
        Condition: {
          StringEquals: {
            'aws:ResourceTag/orgId': orgId,
          },
        },
      },
    ],
  };
}

/**
 * Synchronizes organization roles with SafetyEngine tiers.
 * Higher roles get higher trust scores or lower safety tiers.
 */
export function syncRoleToSafetyTier(role: UserRole): 'local' | 'prod' {
  switch (role) {
    case UserRole.OWNER:
    case UserRole.ADMIN:
      return 'local'; // Lower friction for admins (still safe, but less approval needed)
    default:
      return 'prod'; // Strict gating for members and viewers
  }
}

/**
 * Logs a synchronization event for audit purposes.
 */
export function logSyncEvent(userId: string, orgId: string, role: UserRole): void {
  logger.info(`[RBAC_SYNC] Synced user ${userId} to org ${orgId} with role ${role}`);
}
