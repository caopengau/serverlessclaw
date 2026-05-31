/**
 * @module SafetyEngine
 * @description Granular safety tier enforcement engine.
 */

import {
  SafetyTier,
  IAgentConfig,
  SafetyPolicy,
  SafetyEvaluationResult,
  EvolutionMode,
  SafetyContext,
} from '../types/agent';
import { TRUST } from '../constants';
import { CLASS_C_ACTIONS } from '../constants/safety';
import { SafetyConfigManager } from './safety-config-manager';
import { SafetyRateLimiter, ToolSafetyOverride } from './safety-limiter';
import { PolicyValidator } from './policy-validator';
import { EvolutionScheduler } from './evolution-scheduler';
import { SafetyBase } from './safety-base';
import { BaseMemoryProvider } from '../memory/base';
import { AgentRegistry } from '../registry';
import { CONFIG_DEFAULTS } from '../config/config-defaults';

// Specialized engine modules
import { validateStaticPolicies, validateRBAC } from './engine/rbac';
import { validateAccessControl } from './engine/access-control';
import { checkAutonomousPromotion } from './engine/autonomy';
import { checkTrustEscalation } from './engine/escalation';

let sharedEngine: SafetyEngine | null = null;

export function getSafetyEngine(
  customPolicies?: Partial<Record<SafetyTier, Partial<SafetyPolicy>>>,
  toolOverrides?: ToolSafetyOverride[],
  base?: BaseMemoryProvider
): SafetyEngine {
  if (!sharedEngine) {
    sharedEngine = new SafetyEngine(customPolicies, toolOverrides, base);
  }
  return sharedEngine;
}

export function resetSafetyEngine(
  customPolicies?: Partial<Record<SafetyTier, Partial<SafetyPolicy>>>,
  toolOverrides?: ToolSafetyOverride[],
  base?: BaseMemoryProvider
): SafetyEngine {
  sharedEngine = null;
  return getSafetyEngine(customPolicies, toolOverrides, base);
}

export function hasSafetyEngine(): boolean {
  return sharedEngine !== null;
}

function normalizeSafetyAction(action: string, toolName?: string): string {
  if (!toolName) return action;
  const lowerAction = action.toLowerCase();
  const lowerToolName = toolName.toLowerCase();

  if (CLASS_C_ACTIONS.map((a) => a.toLowerCase()).includes(lowerAction)) {
    return lowerAction;
  }
  if (
    lowerToolName.includes('deployment') ||
    lowerToolName.includes('deploy') ||
    lowerToolName.includes('stage')
  )
    return 'deployment';
  if (
    lowerToolName.includes('shell') ||
    lowerToolName.includes('command') ||
    lowerToolName.includes('exec')
  )
    return 'shell_command';
  if (
    lowerToolName.includes('code_change') ||
    lowerToolName.includes('edit') ||
    lowerToolName.includes('write')
  )
    return 'code_change';
  if (
    lowerToolName.includes('iam') ||
    lowerToolName.includes('permission') ||
    lowerToolName.includes('access')
  )
    return 'iam_change';
  // MCP filesystem tools: read/list/search operations map to file_operation (requireFileApproval).
  // Note: write tools are already caught above by the 'write' pattern → code_change.
  if (lowerToolName.startsWith('filesystem_')) return 'file_operation';
  return action;
}

export class SafetyEngine extends SafetyBase {
  private policies: Map<string, Partial<SafetyPolicy>>; // Keyed by "workspaceId#tier"
  private toolOverrides: Map<string, ToolSafetyOverride>; // Keyed by "workspaceId#toolName"
  private limiter: SafetyRateLimiter;
  private validator: PolicyValidator;
  private evolutionScheduler: EvolutionScheduler;

  constructor(
    customPolicies?: Partial<Record<SafetyTier, Partial<SafetyPolicy>>>,
    toolOverrides?: ToolSafetyOverride[],
    base?: BaseMemoryProvider
  ) {
    super();
    this.policies = new Map();
    this.toolOverrides = new Map();
    this.limiter = new SafetyRateLimiter(base);
    this.validator = new PolicyValidator(this);
    this.evolutionScheduler = new EvolutionScheduler(base ?? undefined);

    if (customPolicies) {
      for (const [tier, overrides] of Object.entries(customPolicies)) {
        if (overrides) this.policies.set(`global#${tier}`, overrides);
      }
    }

    if (toolOverrides) {
      for (const override of toolOverrides) {
        this.toolOverrides.set(`global#${override.toolName}`, override);
      }
    }
  }

  async evaluateAction(
    agentConfig: Partial<IAgentConfig> | undefined,
    action: string,
    context?: SafetyContext
  ): Promise<SafetyEvaluationResult> {
    const tier = agentConfig?.safetyTier ?? SafetyTier.PROD;
    const agentId = agentConfig?.id ?? 'unknown';
    const workspaceId = context?.workspaceId ?? 'global';
    const ctx = { ...context, agentId, workspaceId };

    const normalizedAction = normalizeSafetyAction(action, context?.toolName);
    const policy = await this.getResolvedPolicy(tier, workspaceId, context?.orgId);
    if (!policy) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Unknown safety tier: ${tier}`,
      };
    }

    // 1. Hard Security Blocks
    const staticResult = await validateStaticPolicies(
      normalizedAction,
      ctx,
      tier,
      this.handleViolation.bind(this)
    );
    if (!staticResult.allowed) return staticResult;

    const rbacResult = await validateRBAC(
      normalizedAction,
      ctx,
      tier,
      this.handleViolation.bind(this)
    );
    if (!rbacResult.allowed) return rbacResult;

    const accessResult = await validateAccessControl(
      agentConfig,
      normalizedAction,
      ctx,
      tier,
      policy,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this as any, // Cast to avoid deep interface implementation mismatch
      this.validator
    );
    if (!accessResult.allowed || accessResult.requiresApproval) return accessResult;

    const rateResult = await this.limiter.checkRateLimits(policy, normalizedAction, ctx);
    if (!rateResult.allowed) return rateResult;

    // 2. Trust-Driven Autonomy & Escalation (Principle 9 / SC-3.2)

    // Proactive Autonomy (Current Principle 9)
    if (
      context?.isProactive &&
      (agentConfig?.trustScore ?? 0) >= TRUST.AUTONOMY_THRESHOLD &&
      agentConfig?.evolutionMode === EvolutionMode.AUTO
    ) {
      return { allowed: true, requiresApproval: false, appliedPolicy: 'principle_9_proactive' };
    }

    // 3. Dynamic & Soft Restrictions
    const timeResult = await this.validator.checkTimeRestrictions(
      policy,
      normalizedAction,
      tier,
      ctx
    );
    if (!timeResult.allowed || timeResult.requiresApproval) return timeResult;

    const approvalResult = await this.validator.checkApprovalRequirements(
      policy,
      normalizedAction,
      tier,
      ctx
    );

    // Try Escalation (SC-3.2)
    const escalationResult = await checkTrustEscalation(
      agentConfig,
      normalizedAction,
      approvalResult,
      { ...ctx, isClassC: this.isClassCAction(normalizedAction) }
    );
    if (escalationResult) return escalationResult;

    const promotionResult = await checkAutonomousPromotion(
      agentConfig,
      normalizedAction,
      approvalResult,
      ctx
    );
    const finalApprovalResult = promotionResult ?? approvalResult;

    // Blast Radius Enforcement
    if (this.isClassCAction(normalizedAction)) {
      const blastResult = await this.handleClassCAction(
        agentId,
        normalizedAction,
        finalApprovalResult,
        ctx
      );
      if (blastResult) return blastResult;
    }

    return finalApprovalResult;
  }

  private async getResolvedPolicy(
    tier: SafetyTier,
    workspaceId: string = 'global',
    orgId?: string
  ): Promise<SafetyPolicy> {
    const globalPolicies = await SafetyConfigManager.getPolicies({
      workspaceId: workspaceId === 'global' ? undefined : workspaceId,
      orgId,
    });
    const base = globalPolicies[tier];
    let custom = this.policies.get(`${workspaceId}#${tier}`);
    if (!custom && workspaceId !== 'global') {
      custom = this.policies.get(`global#${tier}`);
    }
    return custom ? { ...base, ...custom } : base;
  }

  public async handleViolation(
    ctx: SafetyContext,
    tier: SafetyTier,
    action: string,
    appliedPolicy: string,
    reason: string,
    outcome: 'blocked' | 'approval_required' = 'blocked',
    resource?: string
  ): Promise<SafetyEvaluationResult> {
    const violation = this.createViolation(
      ctx.agentId || 'unknown',
      tier,
      action,
      ctx.toolName,
      resource ?? ctx.resource,
      reason,
      outcome,
      ctx.traceId,
      ctx.userId,
      ctx.workspaceId,
      ctx.orgId,
      ctx.teamId,
      ctx.staffId
    );
    if (violation) await this.logViolation(violation);
    return {
      allowed: outcome === 'approval_required',
      requiresApproval: outcome === 'approval_required',
      reason,
      appliedPolicy,
      violation,
    };
  }

  public async checkToolSafety(
    ctx: SafetyContext,
    tier: SafetyTier,
    action: string
  ): Promise<SafetyEvaluationResult> {
    if (!ctx.toolName) return { allowed: true, requiresApproval: false };
    const workspaceId = ctx.workspaceId ?? 'global';
    let override = this.toolOverrides.get(`${workspaceId}#${ctx.toolName}`);
    if (!override && workspaceId !== 'global') {
      override = this.toolOverrides.get(`global#${ctx.toolName}`);
    }
    const rateLimitResult = await this.limiter.checkToolRateLimit(override, ctx.toolName, ctx);
    if (!rateLimitResult.allowed) return rateLimitResult;
    if (override?.requireApproval)
      return this.handleViolation(
        ctx,
        tier,
        action,
        'tool_override',
        `Tool '${ctx.toolName}' requires manual approval`,
        'approval_required'
      );
    return { allowed: true, requiresApproval: false };
  }

  private async handleClassCAction(
    agentId: string,
    action: string,
    approvalResult: SafetyEvaluationResult,
    ctx: SafetyContext
  ): Promise<SafetyEvaluationResult | null> {
    const error = await this.enforceClassCBlastRadius(agentId, action, ctx.workspaceId);
    if (error) {
      const tier =
        (await AgentRegistry.getAgentConfig(agentId, { workspaceId: ctx.workspaceId }))
          ?.safetyTier ?? SafetyTier.PROD;
      return this.handleViolation(ctx, tier, action, 'blast_radius_limit', error);
    }
    if (approvalResult.requiresApproval) {
      await this.evolutionScheduler.scheduleAction({
        agentId,
        action,
        reason: approvalResult.reason ?? 'Class C action requiring approval',
        timeoutMs: CONFIG_DEFAULTS.EVOLUTIONARY_TIMEOUT_MS.code,
        toolName: ctx.toolName,
        args: ctx.args,
        resource: ctx.resource,
        traceId: ctx.traceId,
        userId: ctx.userId || 'SYSTEM',
        workspaceId: ctx.workspaceId || 'GLOBAL',
        teamId: ctx.teamId,
        orgId: ctx.orgId,
        staffId: ctx.staffId,
      });
      return {
        allowed: false,
        requiresApproval: true,
        reason: approvalResult.reason ?? 'Class C action requires approval',
        appliedPolicy: 'class_c_approval_required',
      };
    }
    await this.trackClassCBlastRadius(agentId, action, ctx.workspaceId, ctx.resource);
    return null;
  }

  updatePolicy(
    tier: SafetyTier,
    updates: Partial<SafetyPolicy>,
    workspaceId: string = 'global'
  ): void {
    const key = `${workspaceId}#${tier}`;
    const existing = this.policies.get(key) || {};
    this.policies.set(key, { ...existing, ...updates });
  }

  setToolOverride(override: ToolSafetyOverride, workspaceId: string = 'global'): void {
    this.toolOverrides.set(`${workspaceId}#${override.toolName}`, override);
  }

  removeToolOverride(toolName: string, workspaceId: string = 'global'): void {
    this.toolOverrides.delete(`${workspaceId}#${toolName}`);
  }
}
