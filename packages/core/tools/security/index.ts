import { ITool, ToolResult, ToolType } from '../../lib/types/index';
import { getIdentityManager } from '../../lib/session/identity/manager';
import { SecurityRegistry } from '../../lib/registry/SecurityRegistry';
import { identitySchema } from './definitions/identity';
import { logger } from '../../lib/logger';
import { UserRole } from '../../lib/session/identity/types';

/**
 * Returns all security-related tools.
 */
export async function getSecurityTools(): Promise<Record<string, ITool>> {
  return {
    identity_get_user: getUserIdentity,
    identity_update_user_role: updateUserRole,
    policy_check_permission: checkPermission,
    policy_propose_ace: proposeAccessControl,
  };
}

/**
 * Tool to retrieve user identity and roles.
 */
export const getUserIdentity: ITool = {
  ...identitySchema.getUser,
  parameters: identitySchema.getUser.parameters as any,
  requiredPermissions: identitySchema.getUser.requiredPermissions as any,
  type: ToolType.FUNCTION,
  connectionProfile: [],
  execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
    try {
      const manager = await getIdentityManager();
      const user = await manager.getUser(args.userId as string, undefined, args.orgId as string);

      if (!user) {
        return {
          text: `User ${args.userId} not found.`,
          images: [],
          metadata: { status: 'not_found' },
          ui_blocks: [],
        };
      }

      const permissions = SecurityRegistry.getRolePermissions(user.role);

      return {
        text: `User: ${user.displayName} (${user.userId})\nRole: ${user.role}\nWorkspaces: ${user.workspaceIds.join(', ')}\nPermissions: ${permissions.length} active.`,
        images: [],
        metadata: { user, permissions },
        ui_blocks: [],
      };
    } catch (e) {
      logger.error('[SecurityTool] getUserIdentity failed:', e);
      return {
        text: `Error: ${(e as Error).message}`,
        images: [],
        metadata: { status: 'error' },
        ui_blocks: [],
      };
    }
  },
};

/**
 * Tool to update user role.
 */
export const updateUserRole: ITool = {
  ...identitySchema.updateUserRole,
  parameters: identitySchema.updateUserRole.parameters as any,
  requiredPermissions: identitySchema.updateUserRole.requiredPermissions as any,
  type: ToolType.FUNCTION,
  connectionProfile: [],
  execute: async (args: Record<string, unknown>, context?: any): Promise<ToolResult> => {
    try {
      const manager = await getIdentityManager();
      const callerId = context?.userId || 'SYSTEM'; // Fallback to SYSTEM if no context

      const success = await manager.updateUserRole(
        args.userId as string,
        args.role as UserRole,
        callerId,
        args.orgId as string
      );

      if (success) {
        return {
          text: `Successfully updated user ${args.userId} to role ${args.role}. Reason: ${args.reason}`,
          images: [],
          metadata: { status: 'success' },
          ui_blocks: [],
        };
      } else {
        return {
          text: `Failed to update user role. Check permissions of caller ${callerId}.`,
          images: [],
          metadata: { status: 'denied' },
          ui_blocks: [],
        };
      }
    } catch (e) {
      return {
        text: `Error: ${(e as Error).message}`,
        images: [],
        metadata: { status: 'error' },
        ui_blocks: [],
      };
    }
  },
};

/**
 * Tool to check permissions for a role.
 */
export const checkPermission: ITool = {
  ...identitySchema.checkPermission,
  parameters: identitySchema.checkPermission.parameters as any,
  requiredPermissions: identitySchema.checkPermission.requiredPermissions as any,
  type: ToolType.FUNCTION,
  connectionProfile: [],
  execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
    const isAllowed = SecurityRegistry.hasPermission(
      args.role as string,
      args.permission as string
    );
    return {
      text: `Permission '${args.permission}' is ${isAllowed ? 'GRANTED' : 'DENIED'} for role '${args.role}'.`,
      images: [],
      metadata: { isAllowed },
      ui_blocks: [],
    };
  },
};

/**
 * Tool to propose Access Control Entries.
 */
export const proposeAccessControl: ITool = {
  ...identitySchema.proposeAccessControl,
  parameters: identitySchema.proposeAccessControl.parameters as any,
  requiredPermissions: identitySchema.proposeAccessControl.requiredPermissions as any,
  type: ToolType.FUNCTION,
  connectionProfile: [],
  execute: async (args: Record<string, unknown>, context?: any): Promise<ToolResult> => {
    try {
      const manager = await getIdentityManager();
      const entry = {
        resourceType: args.resourceType as any,
        resourceId: args.resourceId as string,
        allowedRoles: args.allowedRoles as UserRole[],
        allowedUserIds: args.allowedUserIds as string[] | undefined,
      };

      await manager.addAccessControlEntry(entry, args.orgId as string);

      return {
        text: `Successfully registered Access Control Entry for ${args.resourceType}:${args.resourceId}.\nRoles: ${args.allowedRoles}\nReason: ${args.reason}`,
        images: [],
        metadata: { status: 'success', entry },
        ui_blocks: [],
      };
    } catch (e) {
      return {
        text: `Error: ${(e as Error).message}`,
        images: [],
        metadata: { status: 'error' },
        ui_blocks: [],
      };
    }
  },
};
