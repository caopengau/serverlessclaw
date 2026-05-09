import { BaseMemoryProvider } from '../../../lib/memory/base';
import { updateReputation } from '../../../lib/memory/reputation-operations';

/**
 * Updates an agent's reputation based on task outcome.
 * Decoupled from the main handler to reduce cognitive load and improve testability.
 */
export async function recordTaskReputation(params: {
  agentId: string;
  isSuccess: boolean;
  metadata?: Record<string, unknown>;
  workspaceId?: string;
  teamId?: string;
  staffId?: string;
  traceId?: string;
}): Promise<void> {
  const { agentId, isSuccess, metadata, workspaceId, teamId, staffId, traceId } = params;

  try {
    const latencyMs = (metadata as any)?.durationMs ?? 0;
    await updateReputation(new BaseMemoryProvider(), agentId, isSuccess, latencyMs, {
      scope: { workspaceId, teamId, staffId },
      traceId: traceId || '',
    });
  } catch (error) {
    // Silently fail for background reputation updates
    console.warn(`[Reputation] Failed to update for ${agentId}:`, error);
  }
}
