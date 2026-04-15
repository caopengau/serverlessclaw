import { logger } from '../logger';
import { AuditFinding } from '../../agents/cognition-reflector/lib/audit-definitions';
import { MCPBridge } from '../mcp/mcp-bridge';
import { AgentRegistry } from '../registry/AgentRegistry';
import { archiveStaleGaps, cullResolvedGaps, setGap } from '../memory/gap-operations';
import { InsightCategory } from '../types/memory';
import { EvolutionScheduler } from '../safety/evolution-scheduler';
import { FailureEventPayload } from '../schema/events';
import { BaseMemoryProvider } from '../memory';

/**
 * MetabolismService coordinates the "Regenerative Metabolism" silo.
 * It combines observation (auditing) with autonomous repairs (pruning/culling).
 */
export class MetabolismService {
  /**
   * Runs a metabolism audit and performs regenerative repairs if requested.
   * Following the "Perform while Auditing" philosophy.
   *
   * @param memory - The memory provider instance for gap operations.
   * @param options - Audit options.
   * @returns A promise resolving to an array of audit findings.
   */
  static async runMetabolismAudit(
    memory: BaseMemoryProvider,
    options: { repair?: boolean; workspaceId?: string } = {}
  ): Promise<AuditFinding[]> {
    const findings: AuditFinding[] = [];
    const workspaceId = options.workspaceId || 'default';
    logger.info(`[Metabolism] Starting regenerative audit (repair: ${!!options.repair})`);

    // 1. Perform automated repairs for stateless state (Registry/Memory)
    if (options.repair) {
      const repairs = await this.executeRepairs(memory, workspaceId);
      findings.push(...repairs);
    }

    // 2. Delegate to AIReady (AST) MCP if available
    const mcpFindings = await this.runMcpAudit(workspaceId);
    findings.push(...mcpFindings);

    // 3. Fallback to native audit if MCP failed or returned no tools
    const hasMcpFail = mcpFindings.some((f) => f.recommendation.includes('Ensure AST server'));
    if (mcpFindings.length === 0 || hasMcpFail) {
      const nativeFindings = await this.runNativeAudit(workspaceId);
      findings.push(...nativeFindings);
    }

    return findings;
  }

  /**
   * Executes autonomous repairs on system state.
   */
  private static async executeRepairs(
    memory: BaseMemoryProvider,
    workspaceId: string
  ): Promise<AuditFinding[]> {
    const repairFindings: AuditFinding[] = [];

    // Repair 1: Agent Registry Low-Utilization Tools (Principle 10)
    try {
      const pruned = await AgentRegistry.pruneLowUtilizationTools(workspaceId, 30);
      if (pruned > 0) {
        repairFindings.push({
          silo: 'Metabolism',
          expected: 'Lean agent tool registry',
          actual: `Pruned ${pruned} low-utilization tools from agent overrides.`,
          severity: 'P2',
          recommendation: 'Principle 10 (Lean Evolution) enforced via registry pruning.',
        });
      }
    } catch (e) {
      logger.error('[Metabolism] Registry repair failed:', e);
      repairFindings.push({
        silo: 'Metabolism',
        expected: 'Agent registry repair completion',
        actual: `Registry repair failed: ${e instanceof Error ? e.message : String(e)}`,
        severity: 'P1',
        recommendation: 'Investigate DynamoDB connectivity or ConfigManager atomic operations.',
      });
    }

    // Repair 2: Memory Bloat (Stale Gaps)
    try {
      const archived = await archiveStaleGaps(memory, undefined, workspaceId);
      const culled = await cullResolvedGaps(memory, undefined, workspaceId);
      if (archived > 0 || culled > 0) {
        repairFindings.push({
          silo: 'Metabolism',
          expected: 'Clean knowledge state',
          actual: `Metabolized memory state: archived ${archived} stale gaps, culled ${culled} resolved gaps.`,
          severity: 'P2',
          recommendation: 'Knowledge debt recycled into archival storage.',
        });
      }
    } catch (e) {
      logger.error('[Metabolism] Memory repair failed:', e);
      repairFindings.push({
        silo: 'Metabolism',
        expected: 'Memory state repair completion',
        actual: `Memory repair failed: ${e instanceof Error ? e.message : String(e)}`,
        severity: 'P1',
        recommendation: 'Check MemoryProvider authorization and workspaceId isolation.',
      });
    }

    return repairFindings;
  }

  /**
   * Runs the codebase audit via AIReady (AST) MCP server.
   */
  private static async runMcpAudit(_workspaceId?: string): Promise<AuditFinding[]> {
    const findings: AuditFinding[] = [];
    try {
      const astTools = await MCPBridge.getToolsFromServer('ast', '');
      const auditTool = astTools.find((t: { name: string }) =>
        t.name.match(/^(metabolism|codebase)_audit$/)
      );

      if (!auditTool) {
        findings.push({
          silo: 'Metabolism',
          expected: 'MCP-based metabolism audit available',
          actual: 'No metabolism_audit tool found in AIReady (AST) server',
          severity: 'P1',
          recommendation: 'Ensure AST server is deployed or implement native codebase scanner.',
        });
        return findings;
      }

      const result = await auditTool.execute({
        path: './core',
        includeTelemetry: true,
        depth: 'full',
      });

      if (result && typeof result === 'object') {
        const data = (
          'metadata' in result ? (result.metadata as Record<string, unknown>) : result
        ) as Record<string, unknown>;
        const mcpFindings = (data.findings || data.results || []) as Array<{
          expected?: string;
          actual?: string;
          message?: string;
          severity?: string;
          recommendation?: string;
          fix?: string;
        }>;
        if (Array.isArray(mcpFindings)) {
          for (const f of mcpFindings) {
            findings.push({
              silo: 'Metabolism',
              expected: f.expected || 'Lean, optimized system state',
              actual: f.actual || f.message || 'Bloat/Debt detected by AIReady',
              severity: (f.severity as any) || 'P2',
              recommendation: f.recommendation || f.fix || 'Review AIReady report for details.',
            });
          }
        }
      }
    } catch (e) {
      logger.warn('[Metabolism] MCP audit failed, will trigger native fallback:', e);
    }
    return findings;
  }

  /**
   * Performs immediate remediation for a detected dashboard failure.
   * Sh7: Live remediation bridge for real-time system stability.
   */
  static async remediateDashboardFailure(
    memory: BaseMemoryProvider,
    failure: FailureEventPayload
  ): Promise<AuditFinding | undefined> {
    const workspaceId = (failure as Record<string, unknown>).workspaceId as string | undefined;
    logger.info(
      `[Metabolism] Attempting immediate remediation for trace ${failure.traceId} in workspace ${workspaceId}`
    );

    const error = failure.error.toLowerCase();

    // Strategy 1: Registry mismatch/stale overrides (Common dashboard issue)
    if (error.includes('tool') || error.includes('registry') || error.includes('override')) {
      let pruned = false;
      // Surgical remediation: if error contains a specific tool name, prune THAT override specifically
      // e.g. "Tool 'github_createIssue' failed" or "'github_createIssue' tool error"
      const toolMatch =
        failure.error.match(/tool\s+['"]([^'"]+)['"]/i) ||
        failure.error.match(/['"]([^'"]+)['"]\s+tool/i);

      if (toolMatch && toolMatch[1]) {
        const toolName = toolMatch[1];
        const agentId = failure.agentId || 'unknown';

        logger.info(`[Metabolism] Surgical remediation for tool: ${toolName}`);
        pruned = await AgentRegistry.pruneAgentTool(agentId, toolName);
      }

      if (!pruned && workspaceId) {
        // Fallback to broad pruning using atomic utilization check
        const prunedCount = await AgentRegistry.pruneLowUtilizationTools(workspaceId, 1);
        pruned = prunedCount > 0;
      }

      if (pruned) {
        return {
          silo: 'Metabolism',
          expected: 'Consistent agent registry',
          actual: `Real-time repair: Pruned stale/failing tool overrides atomically.`,
          severity: 'P2',
          recommendation: 'Autonomous repair executed successfully via Silo 7 bridge.',
        };
      }
    }

    // Strategy 2: Memory/Gap inconsistencies
    if (error.includes('memory') || error.includes('gap')) {
      await cullResolvedGaps(memory, undefined, workspaceId);
      return {
        silo: 'Metabolism',
        expected: 'Clean memory state',
        actual: `Real-time repair: Culled resolved gaps to resolve memory inconsistency.`,
        severity: 'P2',
        recommendation: 'Autonomous repair executed successfully.',
      };
    }

    // Fallback: Schedule HITL evolution for complex/unknown errors
    logger.warn(
      `[Metabolism] Complex error detected, scheduling HITL remediation: ${failure.error}`
    );
    const scheduler = new EvolutionScheduler(memory);
    await scheduler.scheduleAction({
      agentId: failure.agentId || 'unknown',
      action: 'REMEDIATION',
      reason: `Unresolved dashboard error: ${failure.error}`,
      timeoutMs: 3600000, // 1 hour
      traceId: failure.traceId,
      userId: failure.userId,
    });

    // Also propagate as a strategic gap for visibility
    await setGap(
      memory,
      `REMEDIATION-${failure.traceId}`,
      `Immediate remediation required: ${failure.error}`,
      { category: InsightCategory.STRATEGIC_GAP, urgency: 5, impact: 8 }
    );

    return undefined;
  }

  /**
   * Runs naive native checks for common debt markers.
   */
  private static async runNativeAudit(_workspaceId?: string): Promise<AuditFinding[]> {
    const findings: AuditFinding[] = [];

    // Always report that native scan is running
    findings.push({
      silo: 'Metabolism',
      expected: 'Native technical debt scan performed',
      actual: 'Scanning codebase for P3 debt markers (TODO/FIXME)...',
      severity: 'P3',
      recommendation: 'AIReady MCP unavailable. Falling back to native debt markers.',
    });

    try {
      const { runShellCommand } = await import('../../tools/system/fs');
      const result = await runShellCommand.execute({
        command: "grep -rE '(TODO|FIXME)' ./core | head -n 20",
      });

      if (result && typeof result === 'string') {
        const lines = result.split('\n').filter((l: string) => l.trim());
        if (lines.length > 0) {
          findings.push({
            silo: 'Metabolism',
            expected: 'Zero technical debt markers in core paths',
            actual: `Native scan: Found ${lines.length} debt markers (TODO/FIXME) in core files.`,
            severity: 'P3',
            recommendation: 'Review detected markers and schedule refactoring sprints.',
          });
        }
      }
    } catch (e) {
      logger.warn('[Metabolism] Native debt scan failed:', e);
    }
    return findings;
  }
}
