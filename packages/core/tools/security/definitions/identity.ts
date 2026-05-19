import { Permission } from '../../../../lib/session/identity/types';

export const identitySchema = {
  getUser: {
    name: 'identity_get_user',
    description: 'Retrieves identity information and roles for a specific user.',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The unique ID of the user.' },
        orgId: { type: 'string', description: 'Optional organization ID context.' },
      },
      required: ['userId'],
    },
    requiredPermissions: [Permission.DASHBOARD_VIEW],
  },
  updateUserRole: {
    name: 'identity_update_user_role',
    description: 'Updates the role of a user within a workspace or globally. Requires ADMIN/OWNER permissions.',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'The unique ID of the user to update.' },
        role: { type: 'string', description: 'The new role (owner, admin, member, viewer, or custom).' },
        workspaceId: { type: 'string', description: 'Optional workspace to scope the role to.' },
        reason: { type: 'string', description: 'Rationale for the role update.' },
      },
      required: ['userId', 'role', 'reason'],
    },
    requiredPermissions: [Permission.WORKSPACE_MEMBERS],
    sensitive: true,
  },
  checkPermission: {
    name: 'policy_check_permission',
    description: 'Checks if a specific permission is granted for a role.',
    parameters: {
      type: 'object',
      properties: {
        role: { type: 'string', description: 'The user or agent role to check.' },
        permission: { type: 'string', description: 'The permission string (e.g. agent:invoke, goldex:trade_execute).' },
      },
      required: ['role', 'permission'],
    },
    requiredPermissions: [Permission.AGENT_VIEW],
  },
  proposeAccessControl: {
    name: 'policy_propose_ace',
    description: 'Proposes a new Access Control Entry (ACE) for a specific resource. Sensitive changes will enter a 1-hour cooling period for HITL audit.',
    parameters: {
      type: 'object',
      properties: {
        resourceType: { type: 'string', enum: ['agent', 'workspace', 'config', 'trace'], description: 'The type of resource.' },
        resourceId: { type: 'string', description: 'The unique ID of the resource.' },
        allowedRoles: { type: 'array', items: { type: 'string' }, description: 'List of roles granted access.' },
        allowedUserIds: { type: 'array', items: { type: 'string' }, description: 'Specific user IDs granted access.' },
        reason: { type: 'string', description: 'Business justification for the access grant.' },
      },
      required: ['resourceType', 'resourceId', 'allowedRoles', 'reason'],
    },
    requiredPermissions: [Permission.WORKSPACE_POLICY_UPDATE],
    sensitive: true,
  },
};
