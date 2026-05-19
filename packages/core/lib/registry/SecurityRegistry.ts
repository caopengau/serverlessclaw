import { UserRole, Permission, AgentRole } from '../session/identity/types';
import {
  ROLE_PERMISSIONS,
  AGENT_ROLE_PERMISSIONS,
  WORKSPACE_SCOPED_PERMISSIONS,
} from '../session/identity/constants';
import { logger } from '../logger';

/**
 * SecurityRegistry allows dynamic registration of roles and permissions.
 * This enables plugins to extend the RBAC system without modifying core constants.
 */
export class SecurityRegistry {
  private static customRolePermissions: Record<string, string[]> = {};
  private static customAgentRolePermissions: Record<string, string[]> = {};
  private static customWorkspaceScopedPermissions: Set<string> = new Set();

  /**
   * Registers custom permissions for a user role.
   * Can be used to override core roles or define entirely new ones.
   */
  static registerRolePermissions(role: UserRole | string, permissions: (Permission | string)[]) {
    const roleKey = role.toString();
    const existing = this.customRolePermissions[roleKey] || [];
    this.customRolePermissions[roleKey] = [...new Set([...existing, ...permissions.map(p => p.toString())])];
    logger.info(`[SecurityRegistry] Registered ${permissions.length} permissions for role: ${roleKey}`);
  }

  /**
   * Registers custom permissions for an agent role.
   */
  static registerAgentRolePermissions(
    role: AgentRole | string,
    permissions: (Permission | string)[]
  ) {
    const roleKey = role.toString();
    const existing = this.customAgentRolePermissions[roleKey] || [];
    this.customAgentRolePermissions[roleKey] = [...new Set([...existing, ...permissions.map(p => p.toString())])];
    logger.info(`[SecurityRegistry] Registered ${permissions.length} permissions for agent role: ${roleKey}`);
  }

  /**
   * Marks specific permissions as workspace-scoped.
   */
  static registerWorkspaceScopedPermissions(permissions: (Permission | string)[]) {
    permissions.forEach((p) => this.customWorkspaceScopedPermissions.add(p.toString()));
  }

  /**
   * Checks if a user role has a specific permission, merging static and dynamic rules.
   */
  static hasPermission(role: UserRole | string, permission: Permission | string): boolean {
    const roleKey = role.toString();
    const permKey = permission.toString();

    // 1. Check dynamic overrides first
    if (this.customRolePermissions[roleKey]?.includes(permKey)) {
      return true;
    }

    // 2. Check static core permissions
    const staticPermissions = ROLE_PERMISSIONS[roleKey as UserRole];
    if (staticPermissions?.map(p => p.toString()).includes(permKey)) {
      return true;
    }

    return false;
  }

  /**
   * Checks if any of the agent roles have the required permission.
   */
  static hasAgentPermission(roles: (AgentRole | string)[], permission: Permission | string): boolean {
    const permKey = permission.toString();

    return roles.some((role) => {
      const roleKey = role.toString();

      // Check dynamic
      if (this.customAgentRolePermissions[roleKey]?.includes(permKey)) {
        return true;
      }

      // Check static
      const staticPermissions = AGENT_ROLE_PERMISSIONS[roleKey as AgentRole];
      if (staticPermissions?.map(p => p.toString()).includes(permKey)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Checks if a permission is workspace-scoped.
   */
  static isWorkspaceScoped(permission: Permission | string): boolean {
    const permKey = permission.toString();

    if (this.customWorkspaceScopedPermissions.has(permKey)) {
      return true;
    }

    return WORKSPACE_SCOPED_PERMISSIONS.has(permKey as any);
  }

  /**
   * Returns all permissions for a given role (merged).
   */
  static getRolePermissions(role: UserRole | string): string[] {
    const roleKey = role.toString();
    const dynamic = this.customRolePermissions[roleKey] || [];
    const staticPerms = (ROLE_PERMISSIONS[roleKey as UserRole] || []).map((p) => p.toString());

    return [...new Set([...dynamic, ...staticPerms])];
  }

  /**
   * Returns all registered user roles (static + dynamic).
   */
  static getAllUserRoles(): string[] {
    const staticRoles = Object.values(UserRole);
    const dynamicRoles = Object.keys(this.customRolePermissions);
    return [...new Set([...staticRoles, ...dynamicRoles])];
  }
}
