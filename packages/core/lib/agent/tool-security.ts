import { getSafetyEngine, getCircuitBreaker } from '../safety';
import { Permission } from '../session/identity';
import { ITool, ToolCall } from '../types/index';
import { logger } from '../logger';
import type { ToolExecutionContext } from './tool-executor';

export class ToolSecurityValidator {
  static async validate(
    tool: ITool,
    toolCall: ToolCall,
    args: Record<string, unknown>,
    execContext: ToolExecutionContext,
    approvedToolCalls?: string[]
  ): Promise<{
    allowed: boolean;
    reason?: string;
    requiresApproval?: boolean;
    modifiedArgs?: Record<string, unknown>;
  }> {
    // 1. Evolution Context & Fingerprint
    const { EvolutionMode } = await import('../types/agent');
    const evolutionMode = execContext.agentConfig?.evolutionMode ?? EvolutionMode.HITL;

    const { createHash } = await import('crypto');
    const toolCallFingerprint = createHash('sha256')
      .update(`${toolCall.function.name}:${toolCall.function.arguments}`)
      .digest('hex');

    // 2. Safety Engine Evaluation (use singleton)
    const safety = getSafetyEngine();
    const resourcePath = (args.path ||
      args.filePath ||
      args.resource ||
      args.destination ||
      args.source) as string | undefined;

    const safetyAction = tool.safetyAction || tool.name;
    const safetyResult = await safety.evaluateAction(execContext.agentConfig, safetyAction, {
      toolName: tool.name,
      resource: resourcePath,
      traceId: execContext.traceId,
      userId: execContext.userId,
      userRole: execContext.userRole,
      workspaceId: execContext.workspaceId,
      teamId: execContext.teamId,
      staffId: execContext.staffId,
      args,
      pathKeys: tool.pathKeys,
      isProactive: !!execContext.metadata?.isProactive,
    });

    // 3. Circuit Breaker Check
    const cb = getCircuitBreaker('circuit_breaker_state', execContext.workspaceId);
    const cbResult = await cb.canProceed('autonomous');
    if (!cbResult.allowed) {
      logger.error(`[EXECUTOR] System Circuit Breaker is OPEN: ${cbResult.reason}`);
      return {
        allowed: false,
        reason: `System-level safety block active (Circuit Breaker OPEN). ${cbResult.reason}`,
      };
    }

    // Resolve dynamic tool policy override from ConfigTable
    const { ToolPolicyManager } = await import('./tool-policy-manager');
    const { ApprovalStrategy } = await import('./tool-policy');

    const dynamicPolicy = execContext.workspaceId
      ? await ToolPolicyManager.getPolicy(execContext.workspaceId, tool.name)
      : null;

    const requiredPermissions = dynamicPolicy
      ? dynamicPolicy.requiredPermissions
      : ((tool.requiredPermissions as Permission[] | undefined) ?? []);

    const allowedAgents = dynamicPolicy?.allowedAgents;

    const isApproved =
      approvedToolCalls?.includes(toolCall.id) || approvedToolCalls?.includes(toolCallFingerprint);

    // Hard block check
    if (!safetyResult.allowed && !isApproved) {
      logger.warn(
        `[SECURITY] Action blocked for agent '${execContext.agentId}': ${safetyResult.reason}`
      );
      return { allowed: false, reason: `PERMISSION_DENIED - ${safetyResult.reason}` };
    }

    const requiresApproval = dynamicPolicy
      ? dynamicPolicy.approvalStrategy !== ApprovalStrategy.AUTO
      : safetyResult.requiresApproval || tool.requiresApproval;

    // Note: safetyResult.allowed being true with requiresApproval true means it's a soft restriction.
    // In AUTO mode, we only bypass if the SafetyEngine itself didn't flag it as requiring approval
    // (it would have already handled Principle 9 trust-based promotion internally).
    const effectiveApproved =
      isApproved ||
      (evolutionMode === EvolutionMode.AUTO && !requiresApproval && safetyResult.allowed);

    // Self-approval block
    if (args.manuallyApproved === true && !effectiveApproved) {
      logger.warn(
        `[SECURITY] Agent '${execContext.agentId}' attempted to self-approve tool '${tool.name}'.`
      );
      return {
        allowed: false,
        reason: `PERMISSION_DENIED - Self-approval is not allowed for this tool in current mode.`,
      };
    }

    if (requiresApproval && !effectiveApproved) {
      logger.info(
        `Tool ${tool.name} requires human approval. Reason: ${safetyResult.reason || 'Dynamic policy requirement'}. Pausing...`
      );
      return {
        allowed: false,
        requiresApproval: true,
        reason: safetyResult.reason || 'Dynamic policy approval required',
      };
    }

    // 4A. Swarm Whitelist Containment Check (Dynamic)
    if (allowedAgents && allowedAgents.length > 0) {
      if (!allowedAgents.includes(execContext.agentId)) {
        logger.warn(
          `[SECURITY] Agent '${execContext.agentId}' is not whitelisted to execute tool '${tool.name}'. Whitelist: ${allowedAgents.join(', ')}`
        );
        return {
          allowed: false,
          reason: `AGENT_CONTAINMENT_BLOCK - Agent '${execContext.agentId}' is not authorized to use tool '${tool.name}'.`,
        };
      }
    }

    // 4B. Human User RBAC Check (Dynamic/Static)
    if (requiredPermissions && requiredPermissions.length > 0) {
      let hasPermission = false;
      try {
        const { getIdentityManager } = await import('../session/identity');
        const identity = await getIdentityManager();

        if (execContext.userId === 'SYSTEM') {
          // SYSTEM user skips individual permission checks but MUST have a valid workspaceId
          // to ensure multi-tenant isolation during background tasks.
          hasPermission = !!execContext.workspaceId;
          if (!hasPermission) {
            logger.error(`[SECURITY] SYSTEM request rejected: Missing mandatory workspaceId.`);
          }
        } else if (!execContext.userId) {
          hasPermission = false;
        } else {
          hasPermission = true;
          for (const perm of requiredPermissions) {
            const hasP = await identity.hasPermission(
              execContext.userId,
              perm,
              execContext.workspaceId
            );
            if (!hasP) {
              hasPermission = false;
              break;
            }
          }
        }
      } catch (error) {
        logger.error(`RBAC check failed for tool ${tool.name}:`, error);
      }

      if (!hasPermission) {
        logger.warn(`RBAC validation failed for user ${execContext.userId} on tool ${tool.name}`);
        return {
          allowed: false,
          reason: `Unauthorized. You do not have the required permissions (${requiredPermissions.join(', ')}) to execute this tool.`,
        };
      }
    }

    // 5. Agent-Role RBAC Check (Fallback to static if first check was skipped/non-isolated)
    if (!dynamicPolicy && tool.requiredPermissions && tool.requiredPermissions.length > 0) {
      try {
        const { getIdentityManager } = await import('../session/identity');
        const identity = await getIdentityManager();
        const hasAgentPerm = await identity.hasAgentPermission(
          execContext.agentId,
          tool.requiredPermissions[0] as Permission, // Check first permission for agent role alignment
          execContext.workspaceId
        );

        if (!hasAgentPerm) {
          logger.warn(
            `[SECURITY] Agent '${execContext.agentId}' role unauthorized for tool '${tool.name}'. Required: ${tool.requiredPermissions[0]}`
          );
          return {
            allowed: false,
            reason: `AGENT_ROLE_UNAUTHORIZED - Your current role does not permit executing '${tool.name}'.`,
          };
        }
      } catch (error) {
        logger.error(`Agent RBAC check failed for tool ${tool.name}:`, error);
      }
    }

    // 6. Parameter Guardrails Validation (Dynamic Constraints)
    if (dynamicPolicy?.constraints) {
      const constraints = dynamicPolicy.constraints;

      // CLI Shell command blacklists
      if (constraints.commandBlacklist && constraints.commandBlacklist.length > 0) {
        const cmdStr = (args.command || args.cmd || args.script || '') as string;
        if (cmdStr) {
          for (const word of constraints.commandBlacklist) {
            if (cmdStr.toLowerCase().includes(word.toLowerCase())) {
              logger.warn(
                `[SECURITY] Shell execution blocked. Command violates SwarmGuard blacklist: "${word}". Input: "${cmdStr}"`
              );
              return {
                allowed: false,
                reason: `CONTAINMENT_VIOLATION - Command includes restricted instruction: "${word}".`,
              };
            }
          }
        }
      }

      // Path write containment restrictions
      if (constraints.allowedDirectories && constraints.allowedDirectories.length > 0) {
        const filePath = resourcePath;
        if (filePath) {
          let pathAllowed = false;
          const { resolve, normalize } = await import('path');
          const resolvedPath = resolve(normalize(filePath));

          for (const dir of constraints.allowedDirectories) {
            const resolvedDir = resolve(normalize(dir));
            if (resolvedPath.startsWith(resolvedDir)) {
              pathAllowed = true;
              break;
            }
          }

          if (!pathAllowed) {
            logger.warn(
              `[SECURITY] File path blocked. Path "${filePath}" resides outside SwarmGuard whitelisted folders: ${constraints.allowedDirectories.join(', ')}`
            );
            return {
              allowed: false,
              reason: `CONTAINMENT_VIOLATION - File interaction restricted outside whitelisted directories.`,
            };
          }
        }
      }
    }

    // Apply auto-approval flag logic
    const modifiedArgs = { ...args };
    if (evolutionMode === EvolutionMode.AUTO || effectiveApproved) {
      if (modifiedArgs.manuallyApproved !== true && safetyResult.allowed) {
        logger.info(
          `[SECURITY] Activating 'manuallyApproved: true' for tool ${tool.name} (AUTO/Approved mode and safety cleared).`
        );
        modifiedArgs.manuallyApproved = true;
      }
    } else if (modifiedArgs.manuallyApproved === true && !isApproved) {
      logger.warn(
        `[SECURITY] Agent attempted self-approval of protected resource in tool ${tool.name} (HITL mode). Blocked.`
      );
      modifiedArgs.manuallyApproved = false;
    }

    return { allowed: true, modifiedArgs };
  }
}
