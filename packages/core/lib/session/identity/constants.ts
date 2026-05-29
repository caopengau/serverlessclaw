import { UserRole, Permission, AgentRole } from './types';

/**
 * Role-to-permission mapping for users.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.OWNER]: Object.values(Permission),
  [UserRole.ADMIN]: [
    Permission.AGENT_CREATE,
    Permission.AGENT_DELETE,
    Permission.AGENT_UPDATE,
    Permission.AGENT_VIEW,
    Permission.AGENT_CONTROL,
    Permission.AGENT_INVOKE,
    Permission.AGENT_CONFIG,
    Permission.AGENT_ROSTER_INVITE,
    Permission.TASK_CREATE,
    Permission.TASK_CANCEL,
    Permission.TASK_VIEW,
    Permission.TASK_APPROVE,
    Permission.EVOLUTION_VIEW,
    Permission.EVOLUTION_APPROVE,
    Permission.EVOLUTION_TRIGGER,
    Permission.CONFIG_VIEW,
    Permission.CONFIG_UPDATE,
    Permission.WORKSPACE_MEMBERS,
    Permission.WORKSPACE_POLICY_UPDATE,
    Permission.TRACE_VIEW,
    Permission.TRACE_DELETE,
    Permission.DASHBOARD_VIEW,
    Permission.DASHBOARD_ADMIN,
    Permission.MISSION_COMMAND,
  ],
  [UserRole.MEMBER]: [
    Permission.AGENT_VIEW,
    Permission.AGENT_INVOKE,
    Permission.TASK_CREATE,
    Permission.TASK_CANCEL,
    Permission.TASK_VIEW,
    Permission.EVOLUTION_VIEW,
    Permission.CONFIG_VIEW,
    Permission.TRACE_VIEW,
    Permission.DASHBOARD_VIEW,
  ],
  [UserRole.VIEWER]: [
    Permission.AGENT_VIEW,
    Permission.TASK_VIEW,
    Permission.EVOLUTION_VIEW,
    Permission.CONFIG_VIEW,
    Permission.TRACE_VIEW,
    Permission.DASHBOARD_VIEW,
    Permission.ACTION_FINANCIAL,
    Permission.ACTION_DISPATCH,
  ],
};

/**
 * Role-to-permission mapping for agents.
 */
export const AGENT_ROLE_PERMISSIONS: Record<AgentRole, Permission[]> = {
  [AgentRole.ORCHESTRATOR]: [
    Permission.AGENT_VIEW,
    Permission.TASK_CREATE,
    Permission.TASK_VIEW,
    Permission.TRACE_VIEW,
    Permission.MISSION_COMMAND,
  ],
  [AgentRole.WORKER]: [Permission.AGENT_VIEW, Permission.TASK_VIEW, Permission.TRACE_VIEW],
  [AgentRole.CRITIC]: [
    Permission.AGENT_VIEW,
    Permission.TASK_VIEW,
    Permission.TASK_APPROVE,
    Permission.TRACE_VIEW,
    Permission.EVOLUTION_VIEW,
  ],
  [AgentRole.RESEARCHER]: [Permission.AGENT_VIEW, Permission.TASK_VIEW, Permission.TRACE_VIEW],
  [AgentRole.OPERATOR]: [
    Permission.AGENT_VIEW,
    Permission.TASK_VIEW,
    Permission.TRACE_VIEW,
    Permission.ACTION_DISPATCH,
  ],
  [AgentRole.SYSTEM]: Object.values(Permission),
};

/**
 * Permissions that are strictly scoped to workspace membership.
 */
export const WORKSPACE_SCOPED_PERMISSIONS = new Set([
  Permission.WORKSPACE_CREATE,
  Permission.WORKSPACE_DELETE,
  Permission.WORKSPACE_MEMBERS,
  Permission.WORKSPACE_POLICY_UPDATE,
  Permission.AGENT_CREATE,
  Permission.AGENT_DELETE,
  Permission.AGENT_UPDATE,
  Permission.AGENT_VIEW,
  Permission.AGENT_CONTROL,
  Permission.AGENT_INVOKE,
  Permission.AGENT_CONFIG,
  Permission.AGENT_ROSTER_INVITE,
  Permission.TASK_CREATE,
  Permission.TASK_CANCEL,
  Permission.TASK_VIEW,
  Permission.TASK_APPROVE,
  Permission.EVOLUTION_VIEW,
  Permission.EVOLUTION_APPROVE,
  Permission.EVOLUTION_TRIGGER,
  Permission.CONFIG_VIEW,
  Permission.CONFIG_UPDATE,
  Permission.TRACE_VIEW,
  Permission.TRACE_DELETE,
  Permission.DASHBOARD_VIEW,
  Permission.MISSION_COMMAND,
  Permission.ACTION_DISPATCH,
  Permission.ACTION_FINANCIAL,
  Permission.ACTION_INFRA,
]);
