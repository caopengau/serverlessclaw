/**
 * @module SafetyEngine
 * @description Granular safety tier enforcement engine for Serverless Claw.
 * Evaluates actions against fine-grained policies including per-tool overrides,
 * resource-level controls, time-based windows, and comprehensive violation logging.
 */

import { SafetyTier, IAgentConfig } from './types/agent';
import { logger } from './logger';

/**
 * Granular safety policy defining rules for a specific safety tier.
 */
export interface SafetyPolicy {
  /** The safety tier this policy applies to. */
  tier: SafetyTier;
  /** Whether code changes require approval. */
  requireCodeApproval: boolean;
  /** Whether deployments require approval. */
  requireDeployApproval: boolean;
  /** Whether file operations require approval. */
  requireFileApproval: boolean;
  /** Whether shell commands require approval. */
  requireShellApproval: boolean;
  /** Whether MCP tool calls require approval. */
  requireMcpApproval: boolean;
  /** List of allowed file paths (glob patterns). */
  allowedFilePaths?: string[];
  /** List of blocked file paths (glob patterns). */
  blockedFilePaths?: string[];
  /** List of allowed API endpoints/domains. */
  allowedApiEndpoints?: string[];
  /** List of blocked API endpoints/domains. */
  blockedApiEndpoints?: string[];
  /** Maximum deployments per day. */
  maxDeploymentsPerDay?: number;
  /** Maximum shell commands per hour. */
  maxShellCommandsPerHour?: number;
  /** Maximum file writes per hour. */
  maxFileWritesPerHour?: number;
  /** Time-based restrictions. */
  timeRestrictions?: TimeRestriction[];
}

/**
 * Time-based restriction window.
 */
export interface TimeRestriction {
  /** Days of week (0 = Sunday, 6 = Saturday). */
  daysOfWeek: number[];
  /** Start hour (0-23). */
  startHour: number;
  /** End hour (0-23). */
  endHour: number;
  /** Timezone (e.g., 'America/New_York'). */
  timezone: string;
  /** Actions restricted during this window. */
  restrictedActions: string[];
  /** Whether to block or require approval during restriction. */
  restrictionType: 'block' | 'require_approval';
}

/**
 * Per-tool safety override configuration.
 */
export interface ToolSafetyOverride {
  /** Tool name. */
  toolName: string;
  /** Whether this tool requires approval regardless of tier. */
  requireApproval?: boolean;
  /** Maximum uses per hour. */
  maxUsesPerHour?: number;
  /** Maximum uses per day. */
  maxUsesPerDay?: number;
  /** Allowed time windows (if restricted). */
  allowedTimeWindows?: TimeRestriction[];
  /** Blocked time windows. */
  blockedTimeWindows?: TimeRestriction[];
}

/**
 * Result of a safety evaluation.
 */
export interface SafetyEvaluationResult {
  /** Whether the action is allowed. */
  allowed: boolean;
  /** Whether human approval is required. */
  requiresApproval: boolean;
  /** Reason for denial or approval requirement. */
  reason?: string;
  /** Specific policy that was violated or applied. */
  appliedPolicy?: string;
  /** Suggested alternative action if denied. */
  suggestion?: string;
}

/**
 * Safety violation record for logging and reporting.
 */
export interface SafetyViolation {
  /** Unique violation ID. */
  id: string;
  /** Timestamp of the violation. */
  timestamp: Date;
  /** Agent that triggered the violation. */
  agentId: string;
  /** Safety tier of the agent. */
  safetyTier: SafetyTier;
  /** Action that was attempted. */
  action: string;
  /** Tool involved (if any). */
  toolName?: string;
  /** Resource involved (file path, API endpoint, etc.). */
  resource?: string;
  /** Reason for the violation. */
  reason: string;
  /** Whether the action was blocked or required approval. */
  outcome: 'blocked' | 'approval_required' | 'allowed';
  /** Session/trace ID for correlation. */
  traceId?: string;
  /** User ID associated with the violation. */
  userId?: string;
}

/**
 * Default safety policies for each tier.
 */
const DEFAULT_POLICIES: Record<SafetyTier, SafetyPolicy> = {
  [SafetyTier.SANDBOX]: {
    tier: SafetyTier.SANDBOX,
    requireCodeApproval: true,
    requireDeployApproval: true,
    requireFileApproval: true,
    requireShellApproval: true,
    requireMcpApproval: true,
    blockedFilePaths: [
      '.git/**',
      '.env*',
      'package-lock.json',
      'pnpm-lock.yaml',
      'node_modules/**',
    ],
    maxDeploymentsPerDay: 2,
    maxShellCommandsPerHour: 10,
    maxFileWritesPerHour: 20,
    timeRestrictions: [
      {
        daysOfWeek: [0, 6], // Weekends
        startHour: 0,
        endHour: 23,
        timezone: 'UTC',
        restrictedActions: ['deployment', 'shell_command'],
        restrictionType: 'require_approval',
      },
    ],
  },
  [SafetyTier.STAGED]: {
    tier: SafetyTier.STAGED,
    requireCodeApproval: false,
    requireDeployApproval: true,
    requireFileApproval: false,
    requireShellApproval: false,
    requireMcpApproval: false,
    blockedFilePaths: [
      '.git/**',
      '.env*',
      'package-lock.json',
      'pnpm-lock.yaml',
      'node_modules/**',
    ],
    maxDeploymentsPerDay: 5,
    maxShellCommandsPerHour: 50,
    maxFileWritesPerHour: 100,
    timeRestrictions: [
      {
        daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
        startHour: 9,
        endHour: 17,
        timezone: 'America/New_York',
        restrictedActions: ['deployment'],
        restrictionType: 'require_approval',
      },
    ],
  },
  [SafetyTier.AUTONOMOUS]: {
    tier: SafetyTier.AUTONOMOUS,
    requireCodeApproval: false,
    requireDeployApproval: false,
    requireFileApproval: false,
    requireShellApproval: false,
    requireMcpApproval: false,
    blockedFilePaths: [
      '.git/**',
      '.env*',
      'package-lock.json',
      'pnpm-lock.yaml',
      'node_modules/**',
    ],
    maxDeploymentsPerDay: 10,
    maxShellCommandsPerHour: 200,
    maxFileWritesPerHour: 500,
  },
};

/**
 * Safety Engine for evaluating actions against granular policies.
 */
export class SafetyEngine {
  private policies: Map<SafetyTier, SafetyPolicy>;
  private toolOverrides: Map<string, ToolSafetyOverride>;
  private violations: SafetyViolation[] = [];
  private rateLimitCounters: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(
    customPolicies?: Partial<Record<SafetyTier, Partial<SafetyPolicy>>>,
    toolOverrides?: ToolSafetyOverride[]
  ) {
    this.policies = new Map();
    this.toolOverrides = new Map();

    // Initialize with default policies
    for (const [tier, policy] of Object.entries(DEFAULT_POLICIES)) {
      this.policies.set(tier as SafetyTier, { ...policy });
    }

    // Apply custom policy overrides
    if (customPolicies) {
      for (const [tier, overrides] of Object.entries(customPolicies)) {
        const existing = this.policies.get(tier as SafetyTier);
        if (existing && overrides) {
          this.policies.set(tier as SafetyTier, { ...existing, ...overrides });
        }
      }
    }

    // Initialize tool overrides
    if (toolOverrides) {
      for (const override of toolOverrides) {
        this.toolOverrides.set(override.toolName, override);
      }
    }

    logger.info('SafetyEngine initialized', {
      tiers: Array.from(this.policies.keys()),
      toolOverrides: this.toolOverrides.size,
    });
  }

  /**
   * Evaluate whether an action is allowed based on the agent's safety tier.
   */
  evaluateAction(
    agentConfig: IAgentConfig | undefined,
    action: string,
    context?: {
      toolName?: string;
      resource?: string;
      traceId?: string;
      userId?: string;
    }
  ): SafetyEvaluationResult {
    const tier = agentConfig?.safetyTier ?? SafetyTier.STAGED;
    const policy = this.policies.get(tier);

    if (!policy) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: `Unknown safety tier: ${tier}`,
        appliedPolicy: 'unknown_tier',
      };
    }

    // Check tool-specific overrides first
    if (context?.toolName) {
      const toolOverride = this.toolOverrides.get(context.toolName);
      if (toolOverride?.requireApproval) {
        const violation = this.createViolation(
          agentConfig?.id ?? 'unknown',
          tier,
          action,
          context.toolName,
          context.resource,
          'Tool requires approval',
          'approval_required',
          context.traceId,
          context.userId
        );
        this.logViolation(violation);

        return {
          allowed: true,
          requiresApproval: true,
          reason: `Tool '${context.toolName}' requires manual approval`,
          appliedPolicy: 'tool_override',
        };
      }

      // Check tool rate limits
      const rateLimitResult = this.checkToolRateLimit(toolOverride, context.toolName);
      if (!rateLimitResult.allowed) {
        return rateLimitResult;
      }
    }

    // Check resource-level controls
    if (context?.resource) {
      const resourceResult = this.checkResourceAccess(policy, context.resource, action, tier, {
        ...context,
        agentId: agentConfig?.id,
      });
      if (!resourceResult.allowed || resourceResult.requiresApproval) {
        return resourceResult;
      }
    }

    // Check time-based restrictions
    const timeResult = this.checkTimeRestrictions(policy, action, tier, {
      ...context,
      agentId: agentConfig?.id,
    });
    if (!timeResult.allowed || timeResult.requiresApproval) {
      return timeResult;
    }

    // Check action-specific approval requirements
    const approvalResult = this.checkApprovalRequirements(policy, action, tier, {
      ...context,
      agentId: agentConfig?.id,
    });
    if (!approvalResult.allowed || approvalResult.requiresApproval) {
      return approvalResult;
    }

    // Check rate limits
    const rateLimitResult = this.checkRateLimits(policy, action, context);
    if (!rateLimitResult.allowed) {
      return rateLimitResult;
    }

    return {
      allowed: true,
      requiresApproval: false,
      appliedPolicy: `${tier}_default`,
    };
  }

  /**
   * Check if a file path is allowed for the given policy.
   */
  private checkResourceAccess(
    policy: SafetyPolicy,
    resource: string,
    action: string,
    tier: SafetyTier,
    context?: { traceId?: string; userId?: string; toolName?: string; agentId?: string }
  ): SafetyEvaluationResult {
    // Check blocked paths first
    if (policy.blockedFilePaths) {
      for (const pattern of policy.blockedFilePaths) {
        if (this.matchesGlob(resource, pattern)) {
          const violation = this.createViolation(
            context?.agentId ?? 'unknown',
            tier,
            action,
            context?.toolName,
            resource,
            `Resource '${resource}' matches blocked pattern '${pattern}'`,
            'blocked',
            context?.traceId,
            context?.userId
          );
          this.logViolation(violation);

          return {
            allowed: false,
            requiresApproval: false,
            reason: `Access to '${resource}' is blocked`,
            appliedPolicy: 'blocked_resource',
            suggestion: 'Choose a different file path that is not protected',
          };
        }
      }
    }

    // Check allowed paths (if specified, resource must match at least one)
    if (policy.allowedFilePaths && policy.allowedFilePaths.length > 0) {
      const isAllowed = policy.allowedFilePaths.some((pattern) =>
        this.matchesGlob(resource, pattern)
      );

      if (!isAllowed) {
        const violation = this.createViolation(
          context?.agentId ?? 'unknown',
          tier,
          action,
          context?.toolName,
          resource,
          `Resource '${resource}' not in allowed paths`,
          'blocked',
          context?.traceId,
          context?.userId
        );
        this.logViolation(violation);

        return {
          allowed: false,
          requiresApproval: false,
          reason: `Resource '${resource}' is not in the allowed list`,
          appliedPolicy: 'resource_not_allowed',
        };
      }
    }

    return { allowed: true, requiresApproval: false };
  }

  /**
   * Check time-based restrictions.
   */
  private checkTimeRestrictions(
    policy: SafetyPolicy,
    action: string,
    tier: SafetyTier,
    context?: { traceId?: string; userId?: string; toolName?: string; agentId?: string }
  ): SafetyEvaluationResult {
    if (!policy.timeRestrictions || policy.timeRestrictions.length === 0) {
      return { allowed: true, requiresApproval: false };
    }

    const now = new Date();

    for (const restriction of policy.timeRestrictions) {
      if (!restriction.restrictedActions.includes(action)) {
        continue;
      }

      // Check if current time falls within restriction window
      const isRestricted = this.isTimeInWindow(now, restriction);

      if (isRestricted) {
        if (restriction.restrictionType === 'block') {
          const violation = this.createViolation(
            context?.agentId ?? 'unknown',
            tier,
            action,
            context?.toolName,
            undefined,
            `Action '${action}' blocked during restricted time window`,
            'blocked',
            context?.traceId,
            context?.userId
          );
          this.logViolation(violation);

          return {
            allowed: false,
            requiresApproval: false,
            reason: `Action '${action}' is not allowed during this time window`,
            appliedPolicy: 'time_restriction',
          };
        } else {
          // require_approval
          const violation = this.createViolation(
            context?.agentId ?? 'unknown',
            tier,
            action,
            context?.toolName,
            undefined,
            `Action '${action}' requires approval during restricted time window`,
            'approval_required',
            context?.traceId,
            context?.userId
          );
          this.logViolation(violation);

          return {
            allowed: true,
            requiresApproval: true,
            reason: `Action '${action}' requires approval during business hours`,
            appliedPolicy: 'time_restriction_approval',
          };
        }
      }
    }

    return { allowed: true, requiresApproval: false };
  }

  /**
   * Check approval requirements based on action type and policy.
   */
  private checkApprovalRequirements(
    policy: SafetyPolicy,
    action: string,
    tier: SafetyTier,
    _context?: { traceId?: string; userId?: string; toolName?: string; agentId?: string }
  ): SafetyEvaluationResult {
    switch (action) {
      case 'code_change':
        if (policy.requireCodeApproval) {
          const violation = this.createViolation(
            _context?.agentId ?? 'unknown',
            tier,
            action,
            _context?.toolName,
            undefined,
            'Code changes require approval in this safety tier',
            'approval_required',
            _context?.traceId,
            _context?.userId
          );
          this.logViolation(violation);
          return {
            allowed: true,
            requiresApproval: true,
            reason: 'Code changes require approval in this safety tier',
            appliedPolicy: `${tier}_${action}_approval`,
          };
        }
        break;
      case 'deployment':
        if (policy.requireDeployApproval) {
          const violation = this.createViolation(
            _context?.agentId ?? 'unknown',
            tier,
            action,
            _context?.toolName,
            undefined,
            'Deployments require approval in this safety tier',
            'approval_required',
            _context?.traceId,
            _context?.userId
          );
          this.logViolation(violation);
          return {
            allowed: true,
            requiresApproval: true,
            reason: 'Deployments require approval in this safety tier',
            appliedPolicy: `${tier}_${action}_approval`,
          };
        }
        break;
      case 'file_operation':
        if (policy.requireFileApproval) {
          const violation = this.createViolation(
            _context?.agentId ?? 'unknown',
            tier,
            action,
            _context?.toolName,
            undefined,
            'File operations require approval in this safety tier',
            'approval_required',
            _context?.traceId,
            _context?.userId
          );
          this.logViolation(violation);
          return {
            allowed: true,
            requiresApproval: true,
            reason: 'File operations require approval in this safety tier',
            appliedPolicy: `${tier}_${action}_approval`,
          };
        }
        break;
      case 'shell_command':
        if (policy.requireShellApproval) {
          const violation = this.createViolation(
            _context?.agentId ?? 'unknown',
            tier,
            action,
            _context?.toolName,
            undefined,
            'Shell commands require approval in this safety tier',
            'approval_required',
            _context?.traceId,
            _context?.userId
          );
          this.logViolation(violation);
          return {
            allowed: true,
            requiresApproval: true,
            reason: 'Shell commands require approval in this safety tier',
            appliedPolicy: `${tier}_${action}_approval`,
          };
        }
        break;
      case 'mcp_tool':
        if (policy.requireMcpApproval) {
          const violation = this.createViolation(
            _context?.agentId ?? 'unknown',
            tier,
            action,
            _context?.toolName,
            undefined,
            'MCP tool calls require approval in this safety tier',
            'approval_required',
            _context?.traceId,
            _context?.userId
          );
          this.logViolation(violation);
          return {
            allowed: true,
            requiresApproval: true,
            reason: 'MCP tool calls require approval in this safety tier',
            appliedPolicy: `${tier}_${action}_approval`,
          };
        }
        break;
      default: {
        // Unknown actions require approval by default
        const violation = this.createViolation(
          _context?.agentId ?? 'unknown',
          tier,
          action,
          _context?.toolName,
          undefined,
          `Unknown action '${action}' requires approval`,
          'approval_required',
          _context?.traceId,
          _context?.userId
        );
        this.logViolation(violation);
        return {
          allowed: true,
          requiresApproval: true,
          reason: `Unknown action '${action}' requires approval`,
          appliedPolicy: `${tier}_${action}_approval`,
        };
      }
    }

    return { allowed: true, requiresApproval: false };
  }

  /**
   * Check rate limits for actions.
   */
  private checkRateLimits(
    policy: SafetyPolicy,
    action: string,
    _context?: { traceId?: string; userId?: string; toolName?: string }
  ): SafetyEvaluationResult {
    const now = Date.now();
    const hourKey = `${action}_hour_${Math.floor(now / 3600000)}`;
    const dayKey = `${action}_day_${Math.floor(now / 86400000)}`;

    // Check hourly limits
    if (action === 'shell_command' && policy.maxShellCommandsPerHour) {
      const hourCount = this.getRateLimitCount(hourKey);
      if (hourCount >= policy.maxShellCommandsPerHour) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: `Shell command rate limit exceeded (${policy.maxShellCommandsPerHour}/hour)`,
          appliedPolicy: 'rate_limit_hourly',
        };
      }
      this.incrementRateLimitCount(hourKey, 3600000);
    }

    if (action === 'file_operation' && policy.maxFileWritesPerHour) {
      const hourCount = this.getRateLimitCount(hourKey);
      if (hourCount >= policy.maxFileWritesPerHour) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: `File write rate limit exceeded (${policy.maxFileWritesPerHour}/hour)`,
          appliedPolicy: 'rate_limit_hourly',
        };
      }
      this.incrementRateLimitCount(hourKey, 3600000);
    }

    // Check daily limits
    if (action === 'deployment' && policy.maxDeploymentsPerDay) {
      const dayCount = this.getRateLimitCount(dayKey);
      if (dayCount >= policy.maxDeploymentsPerDay) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: `Deployment rate limit exceeded (${policy.maxDeploymentsPerDay}/day)`,
          appliedPolicy: 'rate_limit_daily',
        };
      }
      this.incrementRateLimitCount(dayKey, 86400000);
    }

    return { allowed: true, requiresApproval: false };
  }

  /**
   * Check tool-specific rate limits.
   */
  private checkToolRateLimit(
    override: ToolSafetyOverride | undefined,
    toolName: string
  ): SafetyEvaluationResult {
    if (!override) {
      return { allowed: true, requiresApproval: false };
    }

    const now = Date.now();
    const hourKey = `tool_${toolName}_hour_${Math.floor(now / 3600000)}`;
    const dayKey = `tool_${toolName}_day_${Math.floor(now / 86400000)}`;

    if (override.maxUsesPerHour) {
      const hourCount = this.getRateLimitCount(hourKey);
      if (hourCount >= override.maxUsesPerHour) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: `Tool '${toolName}' rate limit exceeded (${override.maxUsesPerHour}/hour)`,
          appliedPolicy: 'tool_rate_limit_hourly',
        };
      }
      this.incrementRateLimitCount(hourKey, 3600000);
    }

    if (override.maxUsesPerDay) {
      const dayCount = this.getRateLimitCount(dayKey);
      if (dayCount >= override.maxUsesPerDay) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: `Tool '${toolName}' rate limit exceeded (${override.maxUsesPerDay}/day)`,
          appliedPolicy: 'tool_rate_limit_daily',
        };
      }
      this.incrementRateLimitCount(dayKey, 86400000);
    }

    return { allowed: true, requiresApproval: false };
  }

  /**
   * Get current rate limit count for a key.
   */
  private getRateLimitCount(key: string): number {
    const counter = this.rateLimitCounters.get(key);
    if (!counter) {
      return 0;
    }

    // Check if counter has expired
    if (Date.now() > counter.resetTime) {
      this.rateLimitCounters.delete(key);
      return 0;
    }

    return counter.count;
  }

  /**
   * Increment rate limit count for a key.
   */
  private incrementRateLimitCount(key: string, ttlMs: number): void {
    const counter = this.rateLimitCounters.get(key);
    if (!counter || Date.now() > counter.resetTime) {
      this.rateLimitCounters.set(key, {
        count: 1,
        resetTime: Date.now() + ttlMs,
      });
    } else {
      counter.count++;
    }
  }

  /**
   * Check if current time falls within a time restriction window.
   */
  private isTimeInWindow(date: Date, restriction: TimeRestriction): boolean {
    const dayOfWeek = date.getUTCDay();
    const hour = date.getUTCHours();

    // Check if today is a restricted day
    if (!restriction.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }

    // Check if current hour is within restriction window
    if (restriction.startHour <= restriction.endHour) {
      // Normal window (e.g., 9-17)
      return hour >= restriction.startHour && hour < restriction.endHour;
    } else {
      // Overnight window (e.g., 22-6)
      return hour >= restriction.startHour || hour < restriction.endHour;
    }
  }

  /**
   * Simple glob pattern matching.
   * Handles ** (match any path including /), * (match except /), and ? (single char).
   */
  private matchesGlob(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    // Step 1: Escape dots
    let regexPattern = pattern.replace(/\./g, '\\.');
    // Step 2: Replace ** with a placeholder to avoid conflicts with single *
    regexPattern = regexPattern.replace(/\*\*/g, '__DOUBLESTAR__');
    // Step 3: Replace single * with [^/]* (matches anything except /)
    regexPattern = regexPattern.replace(/\*/g, '[^/]*');
    // Step 4: Replace placeholder with .* (matches everything including /)
    regexPattern = regexPattern.replace(/__DOUBLESTAR__/g, '.*');
    // Step 5: Replace ? with . (single char wildcard)
    regexPattern = regexPattern.replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Create a safety violation record.
   */
  private createViolation(
    agentId: string,
    safetyTier: SafetyTier,
    action: string,
    toolName: string | undefined,
    resource: string | undefined,
    reason: string,
    outcome: 'blocked' | 'approval_required' | 'allowed',
    traceId?: string,
    userId?: string
  ): SafetyViolation {
    return {
      id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      agentId,
      safetyTier,
      action,
      toolName,
      resource,
      reason,
      outcome,
      traceId,
      userId,
    };
  }

  /**
   * Log a safety violation.
   */
  private logViolation(violation: SafetyViolation): void {
    this.violations.push(violation);

    // Keep only last 1000 violations in memory
    if (this.violations.length > 1000) {
      this.violations = this.violations.slice(-1000);
    }

    logger.warn('Safety violation detected', {
      violationId: violation.id,
      agentId: violation.agentId,
      action: violation.action,
      toolName: violation.toolName,
      resource: violation.resource,
      reason: violation.reason,
      outcome: violation.outcome,
      traceId: violation.traceId,
    });
  }

  /**
   * Get recent safety violations.
   */
  getViolations(limit: number = 100): SafetyViolation[] {
    return this.violations.slice(-limit);
  }

  /**
   * Get violations for a specific agent.
   */
  getViolationsByAgent(agentId: string, limit: number = 100): SafetyViolation[] {
    return this.violations.filter((v) => v.agentId === agentId).slice(-limit);
  }

  /**
   * Get violations for a specific action type.
   */
  getViolationsByAction(action: string, limit: number = 100): SafetyViolation[] {
    return this.violations.filter((v) => v.action === action).slice(-limit);
  }

  /**
   * Clear all violations (useful for testing).
   */
  clearViolations(): void {
    this.violations = [];
  }

  /**
   * Get safety statistics.
   */
  getStats(): {
    totalViolations: number;
    blockedActions: number;
    approvalRequired: number;
    byTier: Record<SafetyTier, number>;
    byAction: Record<string, number>;
  } {
    const stats = {
      totalViolations: this.violations.length,
      blockedActions: 0,
      approvalRequired: 0,
      byTier: {
        [SafetyTier.SANDBOX]: 0,
        [SafetyTier.STAGED]: 0,
        [SafetyTier.AUTONOMOUS]: 0,
      },
      byAction: {} as Record<string, number>,
    };

    for (const violation of this.violations) {
      if (violation.outcome === 'blocked') {
        stats.blockedActions++;
      } else if (violation.outcome === 'approval_required') {
        stats.approvalRequired++;
      }

      stats.byTier[violation.safetyTier]++;
      stats.byAction[violation.action] = (stats.byAction[violation.action] || 0) + 1;
    }

    return stats;
  }

  /**
   * Update policy for a specific tier.
   */
  updatePolicy(tier: SafetyTier, updates: Partial<SafetyPolicy>): void {
    const existing = this.policies.get(tier);
    if (existing) {
      this.policies.set(tier, { ...existing, ...updates });
      logger.info('Safety policy updated', { tier, updates });
    }
  }

  /**
   * Add or update a tool override.
   */
  setToolOverride(override: ToolSafetyOverride): void {
    this.toolOverrides.set(override.toolName, override);
    logger.info('Tool safety override set', { toolName: override.toolName });
  }

  /**
   * Remove a tool override.
   */
  removeToolOverride(toolName: string): void {
    this.toolOverrides.delete(toolName);
    logger.info('Tool safety override removed', { toolName });
  }
}
