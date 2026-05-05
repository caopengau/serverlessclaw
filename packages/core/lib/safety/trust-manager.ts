import { AgentRegistry } from '../registry';
import { DYNAMO_KEYS, TRUST } from '../constants';
import { logger } from '../logger';
import { EventType } from '../types/agent';
import { CognitiveAnomaly, AnomalySeverity } from '../types/metrics';
import { emitEvent } from '../utils/bus';

export interface TrustPenalty {
  agentId: string;
  timestamp: number;
  reason: string;
  delta: number;
  newScore: number;
}

export interface TrustContext {
  workspaceId: string;
  teamId?: string;
  staffId?: string;
}

const DEFAULT_TRUST_CONTEXT: TrustContext = {
  workspaceId: 'default',
};

/**
 * @module TrustManager
 * @description Centralized logic for managing agent TrustScores.
 */
export class TrustManager {
  private static getEffectiveContext(context?: Partial<TrustContext>): TrustContext {
    return { ...DEFAULT_TRUST_CONTEXT, ...context };
  }

  /**
   * Records a failure for an agent and penalizes its trust score.
   */
  static async recordFailure(
    agentId: string,
    reason: string,
    severity: number = 1,
    qualityScore?: number,
    context?: Partial<TrustContext>
  ): Promise<number> {
    const ctx = this.getEffectiveContext(context);

    if (!AgentRegistry.isBackboneAgent(agentId) && ctx.workspaceId === 'default') {
      logger.warn(`[TrustManager] recordFailure for ${agentId} using default workspace.`);
    }

    let penaltyMultiplier = 1;
    if (qualityScore !== undefined) {
      penaltyMultiplier = Math.min(1.5, Math.max(0.5, (10 - qualityScore) / 5 + 0.5));
    }
    const penalty = TRUST.DEFAULT_PENALTY * severity * penaltyMultiplier;

    const newScore = await this.updateTrustScore(agentId, penalty, ctx.workspaceId);
    await this.logPenalty(
      { agentId, timestamp: Date.now(), reason, delta: penalty, newScore },
      ctx
    );

    await emitEvent('system.trust', EventType.REPUTATION_UPDATE, {
      agentId,
      trustScore: newScore,
      metadata: { reason, delta: penalty, type: 'penalty' },
      workspaceId: ctx.workspaceId,
      teamId: ctx.teamId,
      staffId: ctx.staffId,
    });

    return newScore;
  }

  /**
   * Records a success for an agent and earns it trust.
   */
  static async recordSuccess(
    agentId: string,
    qualityScore?: number,
    context?: Partial<TrustContext>
  ): Promise<number> {
    const ctx = this.getEffectiveContext(context);
    let multiplier = 1;
    if (qualityScore !== undefined) {
      multiplier = Math.min(2, Math.max(0, qualityScore * 0.2));
    }
    const bump = TRUST.DEFAULT_SUCCESS_BUMP * multiplier;

    const newScore = await this.updateTrustScore(agentId, bump, ctx.workspaceId);
    logger.info(
      `[TrustManager] Agent ${agentId} earned trust (WS: ${ctx.workspaceId}). Quality: ${qualityScore ?? 'N/A'}. New Score: ${newScore}`
    );

    await emitEvent('system.trust', EventType.REPUTATION_UPDATE, {
      agentId,
      trustScore: newScore,
      metadata: { type: 'success_bump', qualityScore, bump },
      workspaceId: ctx.workspaceId,
      teamId: ctx.teamId,
      staffId: ctx.staffId,
    });

    return newScore;
  }

  static async recordAnomalies(
    agentId: string,
    anomalies: CognitiveAnomaly[],
    context?: Partial<TrustContext> & { windowId?: string }
  ): Promise<number> {
    const ctx = this.getEffectiveContext(context);
    const windowId = context?.windowId;

    if (anomalies.length === 0) {
      const config = await AgentRegistry.getAgentConfig(agentId, { workspaceId: ctx.workspaceId });
      if (!config) throw new Error(`Agent ${agentId} not found`);
      return config.trustScore ?? TRUST.DEFAULT_SCORE;
    }

    if (windowId) {
      const config = await AgentRegistry.getAgentConfig(agentId, { workspaceId: ctx.workspaceId });
      if (config?.lastAnomalyCalibrationAt === windowId) {
        return config.trustScore ?? TRUST.DEFAULT_SCORE;
      }
    }

    let totalDelta = 0;
    const descriptions = anomalies.map((a) => {
      const mod =
        {
          [AnomalySeverity.CRITICAL]: 3,
          [AnomalySeverity.HIGH]: 1.5,
          [AnomalySeverity.MEDIUM]: 0.5,
          [AnomalySeverity.LOW]: 0.1,
        }[a.severity] ?? 1;
      totalDelta += TRUST.DEFAULT_PENALTY * mod;
      return `${a.type}: ${a.description}`;
    });

    try {
      const { ConfigManager } = await import('../registry/config');
      const updates: Record<string, unknown> = { lastUpdated: new Date().toISOString() };
      if (windowId) updates.lastAnomalyCalibrationAt = windowId;

      await ConfigManager.atomicUpdateMapEntity(DYNAMO_KEYS.AGENTS_CONFIG, agentId, updates, {
        workspaceId: ctx.workspaceId,
        increments: { trustScore: totalDelta },
        conditionExpression: windowId
          ? 'attribute_not_exists(#val.#id.#lac) OR #val.#id.#lac <> :windowId'
          : undefined,
        expressionAttributeNames: windowId ? { '#lac': 'lastAnomalyCalibrationAt' } : {},
        expressionAttributeValues: windowId ? { ':windowId': windowId } : {},
      });

      const updated = await AgentRegistry.getAgentConfig(agentId, { workspaceId: ctx.workspaceId });
      const score = updated?.trustScore ?? 0;

      await this.logPenalty(
        {
          agentId,
          timestamp: Date.now(),
          reason: `Batched Cognitive Anomalies: ${descriptions.join(' | ')}`,
          delta: totalDelta,
          newScore: score,
        },
        ctx
      );

      await emitEvent('system.trust', EventType.REPUTATION_UPDATE, {
        agentId,
        trustScore: score,
        metadata: {
          type: 'anomaly_penalty_batch',
          count: anomalies.length,
          delta: totalDelta,
          windowId,
        },
        workspaceId: ctx.workspaceId,
        teamId: ctx.teamId,
        staffId: ctx.staffId,
      });

      return score;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
        const config = await AgentRegistry.getAgentConfig(agentId, {
          workspaceId: ctx.workspaceId,
        });
        return config?.trustScore ?? TRUST.DEFAULT_SCORE;
      }
      throw err;
    }
  }

  private static async updateTrustScore(
    agentId: string,
    delta: number,
    workspaceId: string
  ): Promise<number> {
    const config = await AgentRegistry.getAgentConfig(agentId, { workspaceId });
    if (!config) throw new Error(`Agent ${agentId} not found`);

    if (config.enabled === false || delta === 0) {
      return config.trustScore ?? TRUST.DEFAULT_SCORE;
    }

    try {
      const newScore = await AgentRegistry.atomicIncrementTrustScore(agentId, delta, {
        workspaceId,
        min: TRUST.MIN_SCORE,
        max: TRUST.MAX_SCORE,
      });

      await this.recordHistory(agentId, newScore, { workspaceId });
      return newScore;
    } catch (err) {
      logger.error(
        `[TrustManager] Failed to atomically update trust for ${agentId} (WS: ${workspaceId}):`,
        err
      );
      throw err;
    }
  }

  private static async logPenalty(penalty: TrustPenalty, context: TrustContext): Promise<void> {
    const { ConfigManager } = await import('../registry/config');
    await ConfigManager.appendToList(DYNAMO_KEYS.TRUST_PENALTY_LOG, penalty, {
      limit: 200,
      workspaceId: context.workspaceId,
    });
  }

  private static async recordHistory(
    agentId: string,
    score: number,
    context: TrustContext
  ): Promise<void> {
    const { ConfigManager } = await import('../registry/config');
    await ConfigManager.appendToList(
      `trust:score_history#${agentId}`,
      { agentId, score, timestamp: Date.now() },
      { limit: 200, workspaceId: context.workspaceId }
    );
  }

  static async decayTrustScores(workspaceId: string = 'default'): Promise<void> {
    const configs = await AgentRegistry.getAllConfigs({ workspaceId });
    const agentEntries = Object.entries(configs).filter(
      ([id]) => !AgentRegistry.isBackboneAgent(id)
    );

    const CHUNK_SIZE = 10;
    for (let i = 0; i < agentEntries.length; i += CHUNK_SIZE) {
      const chunk = agentEntries.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(([id, cfg]) => this.decayAgentTrust(id, cfg as any, { workspaceId }))
      );
    }
  }

  private static async decayAgentTrust(
    agentId: string,
    config: { trustScore?: number; lastDecayedAt?: string },
    context: TrustContext
  ): Promise<void> {
    const score = config.trustScore;
    if (score === undefined || score < TRUST.DECAY_BASELINE) return;

    const today = new Date().toISOString().split('T')[0];
    if (config.lastDecayedAt === today) return;

    let multiplier = 1;
    if (score >= TRUST.AUTONOMY_THRESHOLD) multiplier = 1.5;
    else if (score >= 85) multiplier = 1.25;

    const next = Math.max(TRUST.DECAY_BASELINE, score - TRUST.DECAY_RATE * multiplier);
    const delta = Math.round((next - score) * 100) / 100;

    if (delta < 0) {
      try {
        const { AgentRegistry } = await import('../registry');
        const { ConfigManager } = await import('../registry/config');

        await ConfigManager.atomicUpdateMapEntity(
          DYNAMO_KEYS.AGENTS_CONFIG,
          agentId,
          { lastDecayedAt: today, lastUpdated: new Date().toISOString() },
          {
            workspaceId: context.workspaceId,
            increments: { trustScore: delta },
            conditionExpression: 'attribute_not_exists(#val.#id.#ld) OR #val.#id.#ld <> :today',
            expressionAttributeNames: { '#ld': 'lastDecayedAt' },
            expressionAttributeValues: { ':today': today },
          }
        );

        logger.info(
          `[TrustManager] Decayed trust for ${agentId} by ${delta} (WS: ${context.workspaceId})`
        );
        const updated = await AgentRegistry.getAgentConfig(agentId, {
          workspaceId: context.workspaceId,
        });
        if (updated) await this.recordHistory(agentId, updated.trustScore ?? next, context);
      } catch (err: unknown) {
        if (!(err instanceof Error && err.name === 'ConditionalCheckFailedException')) {
          logger.error(
            `[TrustManager] Failed to decay score for ${agentId} (WS: ${context.workspaceId}):`,
            err
          );
        }
      }
    }
  }
}
