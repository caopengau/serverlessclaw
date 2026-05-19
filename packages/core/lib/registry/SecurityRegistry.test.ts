import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityRegistry } from './SecurityRegistry';
import { UserRole, Permission, AgentRole } from '../session/identity/types';

describe('SecurityRegistry', () => {
  beforeEach(() => {
    // Note: Since these are static, we might need a reset method if we want clean state,
    // but for unit tests we can just use unique names for custom roles.
  });

  it('resolves static core permissions', () => {
    expect(SecurityRegistry.hasPermission(UserRole.OWNER, Permission.AGENT_CREATE)).toBe(true);
    expect(SecurityRegistry.hasPermission(UserRole.VIEWER, Permission.AGENT_CREATE)).toBe(false);
  });

  it('allows registering and resolving custom role permissions', () => {
    const CUSTOM_ROLE = 'test-custom-role';
    const CUSTOM_PERM = 'test:custom_action';

    SecurityRegistry.registerRolePermissions(CUSTOM_ROLE, [CUSTOM_PERM]);

    expect(SecurityRegistry.hasPermission(CUSTOM_ROLE, CUSTOM_PERM)).toBe(true);
    expect(SecurityRegistry.hasPermission(CUSTOM_ROLE, Permission.AGENT_VIEW)).toBe(false);
  });

  it('merges dynamic permissions into existing roles', () => {
    const EXTRA_PERM = 'admin:special_power';
    SecurityRegistry.registerRolePermissions(UserRole.ADMIN, [EXTRA_PERM]);

    expect(SecurityRegistry.hasPermission(UserRole.ADMIN, EXTRA_PERM)).toBe(true);
    expect(SecurityRegistry.hasPermission(UserRole.ADMIN, Permission.AGENT_CREATE)).toBe(true);
  });

  it('handles custom agent roles', () => {
    const AGENT_ROLE = 'gold-trader-bot';
    const TRADE_PERM = 'trade:execute';

    SecurityRegistry.registerAgentRolePermissions(AGENT_ROLE, [TRADE_PERM]);

    expect(SecurityRegistry.hasAgentPermission([AGENT_ROLE], TRADE_PERM)).toBe(true);
    expect(SecurityRegistry.hasAgentPermission(['other-role', AGENT_ROLE], TRADE_PERM)).toBe(true);
    expect(SecurityRegistry.hasAgentPermission(['other-role'], TRADE_PERM)).toBe(false);
  });

  it('identifies custom workspace-scoped permissions', () => {
    const GLOBAL_PERM = 'sys:global_view';
    const SCOPED_PERM = 'sys:scoped_edit';

    SecurityRegistry.registerWorkspaceScopedPermissions([SCOPED_PERM]);

    expect(SecurityRegistry.isWorkspaceScoped(SCOPED_PERM)).toBe(true);
    expect(SecurityRegistry.isWorkspaceScoped(GLOBAL_PERM)).toBe(false);
    // Core scoped perms still work
    expect(SecurityRegistry.isWorkspaceScoped(Permission.AGENT_INVOKE)).toBe(true);
  });

  it('returns all user roles including dynamic ones', () => {
    SecurityRegistry.registerRolePermissions('dynamic-role-x', ['perm-1']);
    const roles = SecurityRegistry.getAllUserRoles();
    expect(roles).toContain('owner');
    expect(roles).toContain('dynamic-role-x');
  });
});
