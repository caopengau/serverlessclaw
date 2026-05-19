import { UserRole } from './common';
export { UserRole };

/**
 * Permission types.
 */
export enum Permission {
  // Agent permissions
  AGENT_CREATE = 'agent:create',
  AGENT_DELETE = 'agent:delete',
  AGENT_UPDATE = 'agent:update',
  AGENT_VIEW = 'agent:view',
  AGENT_CONTROL = 'agent:control', // Start/Stop/Force
  AGENT_INVOKE = 'agent:invoke', // Permitted to send messages / run loop on the agent
  AGENT_CONFIG = 'agent:config', // Permitted to modify agent system prompts / settings
  AGENT_ROSTER_INVITE = 'agent:roster-invite', // Permitted to add an agent to a workspace

  // Task permissions
  TASK_CREATE = 'task:create',
  TASK_CANCEL = 'task:cancel',
  TASK_VIEW = 'task:view',
  TASK_APPROVE = 'task:approve',

  // Evolution permissions
  EVOLUTION_VIEW = 'evolution:view',
  EVOLUTION_APPROVE = 'evolution:approve',
  EVOLUTION_TRIGGER = 'evolution:trigger',

  // Configuration permissions
  CONFIG_VIEW = 'config:view',
  CONFIG_UPDATE = 'config:update',

  // Workspace permissions
  WORKSPACE_CREATE = 'workspace:create',
  WORKSPACE_DELETE = 'workspace:delete',
  WORKSPACE_MEMBERS = 'workspace:members',
  WORKSPACE_POLICY_UPDATE = 'workspace:policy',

  // Trace permissions
  TRACE_VIEW = 'trace:view',
  TRACE_DELETE = 'trace:delete',

  // Dashboard permissions
  DASHBOARD_VIEW = 'dashboard:view',
  DASHBOARD_ADMIN = 'dashboard:admin',

  // Mission & Action permissions
  MISSION_COMMAND = 'mission:command',
  ACTION_DISPATCH = 'action:dispatch',
  ACTION_FINANCIAL = 'action:financial',
  ACTION_INFRA = 'action:infra',
}

/**
 * Agent Roles for RBAC within the swarm.
 */
export enum AgentRole {
  ORCHESTRATOR = 'ORCHESTRATOR',
  WORKER = 'WORKER',
  CRITIC = 'CRITIC',
  RESEARCHER = 'RESEARCHER',
  TRADER = 'TRADER',
  OPERATOR = 'OPERATOR',
  SYSTEM = 'SYSTEM',
}

/**
 * Access control entry for workspace resources.
 */
export interface AccessControlEntry {
  /** Resource type. */
  resourceType: 'agent' | 'workspace' | 'config' | 'trace';
  /** Resource ID. */
  resourceId: string;
  /** Parent resource ID for inheritance (e.g., workspace ID for nested resources). */
  parentId?: string;
  /** Allowed roles. */
  allowedRoles: (UserRole | string)[];
  /** Specific user IDs with access (overrides role). */
  allowedUserIds?: string[];
}
