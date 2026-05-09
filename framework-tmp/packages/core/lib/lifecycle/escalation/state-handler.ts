import { DynamoMemory } from '../../memory';
import { EscalationState } from '../../types/escalation';
import { logger } from '../../logger';

/**
 * Logic for managing the persistence of escalation state.
 */
export class EscalationStateHandler {
  private memory: DynamoMemory;

  constructor() {
    this.memory = new DynamoMemory();
  }

  async saveState(state: EscalationState): Promise<void> {
    await this.memory.saveEscalationState(state, {
      workspaceId: state.workspaceId,
      teamId: state.teamId,
      staffId: state.staffId,
    });
  }

  async getState(
    traceId: string,
    agentId: string,
    scope?: { workspaceId?: string }
  ): Promise<EscalationState | null> {
    return this.memory.getEscalationState(traceId, agentId, scope);
  }

  async completeEscalation(
    state: EscalationState,
    finalOutcome: EscalationState['outcome']
  ): Promise<void> {
    const updated: EscalationState = {
      ...state,
      outcome: finalOutcome,
    };
    await this.saveState(updated);
    logger.info(`Escalation for ${state.traceId} completed with outcome: ${finalOutcome}`);
  }
}
