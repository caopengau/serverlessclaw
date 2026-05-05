/**
 * Escalation Policy Manager
 * Handles multi-channel, time-based escalation for human-agent interactions
 */

import { logger } from '../logger';
import { emitEvent, EventPriority } from '../utils/bus';
import { EventType } from '../types/agent';
import { sendOutboundMessage } from '../outbound';
import { EscalationPolicy, EscalationState } from '../types/escalation';
import { EscalationPolicyHandler } from './escalation/policy-handler';
import { EscalationStateHandler } from './escalation/state-handler';

/**
 * Manages escalation processes for human-agent interactions.
 * Decomposed for maintainability and AI readiness.
 */
export class EscalationManager {
  private policyHandler: EscalationPolicyHandler;
  private stateHandler: EscalationStateHandler;

  constructor() {
    this.policyHandler = new EscalationPolicyHandler();
    this.stateHandler = new EscalationStateHandler();
  }

  async getPolicy(userId: string, priority: string = 'medium'): Promise<EscalationPolicy> {
    return this.policyHandler.getPolicy(userId, priority);
  }

  async savePolicy(userId: string | 'global', policy: EscalationPolicy): Promise<void> {
    return this.policyHandler.savePolicy(userId, policy);
  }

  /**
   * Starts a new escalation process
   */
  async startEscalation(
    traceId: string,
    agentId: string,
    userId: string,
    question: string,
    originalTask: string,
    sessionId?: string,
    policyId?: string,
    scope?: { workspaceId?: string; teamId?: string; staffId?: string }
  ): Promise<EscalationState> {
    try {
      const policy = policyId
        ? await this.policyHandler.getPolicyById(policyId)
        : await this.policyHandler.getPolicy(userId);

      if (!policy.enabled) {
        throw new Error('Escalation policy is disabled');
      }

      const now = Date.now();
      const state: EscalationState = {
        traceId,
        agentId,
        userId,
        sessionId: sessionId || 'default',
        policyId: policy.id,
        status: 'active',
        currentLevel: 0,
        startTime: now,
        updatedAt: now,
        nextEscalationAt: now + policy.levels[0].delayMinutes * 60000,
        workspaceId: scope?.workspaceId,
        teamId: scope?.teamId,
        staffId: scope?.staffId,
      };

      await this.stateHandler.saveState(state);
      logger.info(`Started escalation for trace ${traceId}, agent ${agentId}`);

      // Initial notification
      await sendOutboundMessage(
        'escalation-manager',
        userId,
        `Hello! Agent '${agentId}' needs some clarification to proceed with your task.\n\n` +
          `**Question:**\n${question}\n\n` +
          `**Task:** ${originalTask}\n\n` +
          `Please respond to this message to continue.`,
        undefined,
        state.sessionId,
        'SystemGuard',
        undefined,
        undefined,
        undefined,
        state.workspaceId,
        state.teamId,
        state.staffId
      );

      return state;
    } catch (error) {
      logger.error('Failed to start escalation:', error);
      throw error;
    }
  }

  /**
   * Processes active escalations that have reached their next level delay.
   */
  async processEscalations(): Promise<void> {
    // Logic for periodic processing would go here, usually triggered by a cron event.
  }

  async handleUserResponse(traceId: string, agentId: string): Promise<void> {
    const state = await this.stateHandler.getState(traceId, agentId);
    if (!state || state.status !== 'active') return;

    await this.stateHandler.completeEscalation(state, 'resolved');
    logger.info(`Escalation for ${traceId} resolved by user response.`);
  }

  private async notifyFinalFailure(
    state: EscalationState,
    question: string,
    originalTask: string
  ): Promise<void> {
    await sendOutboundMessage(
      'escalation-manager',
      state.userId,
      `❌ **Escalation Failed**\n\n` +
        `Agent '${state.agentId}' requested clarification but received no response after all escalation attempts.\n\n` +
        `**Question:**\n${question}\n\n` +
        `**Task:** ${originalTask}\n\n` +
        `The task has been marked as failed.`,
      undefined,
      state.sessionId,
      'SystemGuard',
      undefined,
      undefined,
      undefined,
      state.workspaceId,
      state.teamId,
      state.staffId
    );

    await emitEvent(
      'escalation-manager',
      EventType.TASK_FAILED,
      {
        userId: state.userId,
        agentId: state.agentId,
        task: originalTask,
        error: `Escalation failed. Question: ${question}`,
        traceId: state.traceId,
        sessionId: state.sessionId,
        workspaceId: state.workspaceId,
        teamId: state.teamId,
        staffId: state.staffId,
      },
      { priority: EventPriority.CRITICAL }
    );
  }
}

export const escalationManager = new EscalationManager();
