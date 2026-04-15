/**
 * @module SafetyBase
 * @description Base class for SafetyEngine providing trust recording, violation tracking, and common utilities.
 */

import { TrustManager } from './trust-manager';
import { SafetyTier, SafetyViolation } from '../types/agent';
import { logger } from '../logger';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { defaultDocClient } from '../registry/config';
import { Resource } from 'sst';
import { getBlastRadiusStore, BlastRadiusStore } from './blast-radius-store';
import { isProtectedPath, matchesGlob } from '../utils/fs-security';
import { CLASS_C_ACTIONS, CLASS_D_ACTIONS, SAFETY_LIMITS } from '../constants/safety';

export class SafetyBase {
  protected violations: SafetyViolation[] = [];
  protected blastRadiusStore: BlastRadiusStore;

  constructor() {
    this.blastRadiusStore = getBlastRadiusStore();
  }

  /**
   * Records a failure for an agent and penalizes its trust score.
   */
  async recordFailure(
    agentId: string,
    reason: string,
    severity?: number,
    qualityScore?: number
  ): Promise<number> {
    return TrustManager.recordFailure(agentId, reason, severity, qualityScore);
  }

  /**
   * Records a success for an agent and increments its trust score.
   */
  async recordSuccess(agentId: string, qualityScore?: number): Promise<number> {
    return TrustManager.recordSuccess(agentId, qualityScore);
  }

  /**
   * Checks if a resource path matches any system-level protection rules.
   */
  public isSystemProtected(resource: string): boolean {
    return isProtectedPath(resource);
  }

  /**
   * Determine if an action is Class C (sensitive change requiring approval).
   */
  public isClassCAction(action: string): boolean {
    return (CLASS_C_ACTIONS as readonly string[]).includes(action.toLowerCase());
  }

  /**
   * Determine if an action is Class D (permanently blocked).
   */
  public isClassDAction(action: string): boolean {
    return (CLASS_D_ACTIONS as readonly string[]).includes(action.toLowerCase());
  }

  /**
   * Create a safety violation record.
   */
  public createViolation(
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
      id: `violation_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
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
  public async logViolation(violation: SafetyViolation): Promise<void> {
    this.violations.push(violation);

    // Enforce strict memory limit for serverless environments (Principle 11 & 10)
    if (this.violations.length > SAFETY_LIMITS.VIOLATION_MEMORY_LIMIT) {
      this.violations = this.violations.slice(-SAFETY_LIMITS.VIOLATION_MEMORY_LIMIT);
    }

    // Persist to DynamoDB immediately for audit trail
    await this.persistViolations();

    logger.warn('Safety violation detected', {
      violationId: violation.id,
      agentId: violation.agentId,
      action: violation.action,
      reason: violation.reason,
      outcome: violation.outcome,
    });
  }

  /**
   * Persist violations to DynamoDB for audit trail.
   */
  async persistViolations(): Promise<void> {
    if (this.violations.length === 0) return;

    const resource = Resource as { ConfigTable?: { name: string } };
    if (!('ConfigTable' in resource)) {
      logger.error('[CRITICAL] SafetyEngine telemetry blindness: ConfigTable not linked.');
      return;
    }

    const violationsToPersist = [...this.violations];
    const batchSize = 25;
    const now = Date.now();

    for (let i = 0; i < violationsToPersist.length; i += batchSize) {
      const batch = violationsToPersist.slice(i, i + batchSize);
      const agentIds = [...new Set(batch.map((v) => v.agentId))];
      const agentId = agentIds.length === 1 ? agentIds[0] : 'batch';

      await this.persistBatchWithRetry(batch, agentId, now, resource.ConfigTable?.name);
    }
  }

  private async persistBatchWithRetry(
    batch: SafetyViolation[],
    agentId: string,
    now: number,
    tableName: string | undefined
  ): Promise<boolean> {
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await defaultDocClient.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              key: `safety:violations:${agentId}:${now}`,
              value: { violations: batch, count: batch.length, timestamp: now },
            },
          })
        );
        return true;
      } catch (e) {
        if (attempt === maxRetries) {
          logger.error(`[SafetyBase] Failed to persist violations after retries: ${e}`);
        }
      }
    }
    return false;
  }

  /**
   * Track blast radius for Class C actions.
   */
  protected async trackClassCBlastRadius(
    agentId: string,
    action: string,
    resource?: string
  ): Promise<void> {
    const entry = await this.blastRadiusStore.incrementBlastRadius(agentId, action, resource);
    logger.info('[SafetyBase] Class C action tracked', { agentId, action, count: entry.count });
  }

  /**
   * Enforces blast radius limits for Class C actions per agent.
   */
  protected async enforceClassCBlastRadius(
    agentId: string,
    action: string
  ): Promise<string | null> {
    const result = await this.blastRadiusStore.canExecute(agentId, action);
    return result.allowed ? null : (result.error ?? 'Blast radius exceeded');
  }

  public matchesGlob(path: string, pattern: string): boolean {
    return matchesGlob(path, pattern);
  }

  getViolations(limit: number = 100): SafetyViolation[] {
    return this.violations.slice(-limit);
  }

  /**
   * Get Class C blast radius stats for all tracked actions.
   */
  public getClassCBlastRadius(): Record<
    string,
    { count: number; affectedResources: number; lastAction: number }
  > {
    const stats = this.blastRadiusStore.getLocalStats();
    const result: Record<string, { count: number; affectedResources: number; lastAction: number }> =
      {};
    for (const [key, entry] of Object.entries(stats)) {
      result[key] = {
        count: entry.count,
        affectedResources: (entry as any).affectedResources ?? 0,
        lastAction: entry.lastAction,
      };
    }
    return result;
  }

  /**
   * Legacy static helper for tests.
   */
  public static getClassCActions(): string[] {
    return [...CLASS_C_ACTIONS];
  }

  /**
   * Legacy static helper for tests.
   */
  public static getClassDActions(): string[] {
    return [...CLASS_D_ACTIONS];
  }
}
