import { logger } from '../../lib/logger';
import type { DynamoMemory } from '../../lib/memory';

/**
 * Gets the current evolution mode from configuration.
 */
export async function getEvolutionMode(): Promise<'auto' | 'hitl'> {
  try {
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const { Resource } = await import('sst');

    const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    const typedResource = Resource as unknown as { ConfigTable: { name: string } };

    const response = await db.send(
      new GetCommand({
        TableName: typedResource.ConfigTable.name,
        Key: { key: 'evolution_mode' },
      })
    );
    return response.Item?.value === 'auto' ? 'auto' : 'hitl';
  } catch (error) {
    logger.warn('Failed to fetch evolution_mode, defaulting to hitl:', error);
    return 'hitl';
  }
}

export const COOLDOWN_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Checks if a gap is in cooldown period.
 */
export async function isGapInCooldown(
  memory: DynamoMemory,
  gapId: string,
  baseUserId: string
): Promise<boolean> {
  const cooldownKey = `COOLDOWN_GAPS#${baseUserId}`;
  try {
    const raw = await memory.getDistilledMemory(cooldownKey);
    const entries: Array<{ gapId: string; expiresAt: number }> = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const active = entries.filter((e) => e.expiresAt > now);
    return active.some((e) => e.gapId === gapId);
  } catch {
    logger.warn('Failed to read cooldown state, proceeding anyway.');
    return false;
  }
}

/**
 * Records a gap in cooldown after processing.
 */
export async function recordCooldown(
  memory: DynamoMemory,
  gapId: string,
  baseUserId: string
): Promise<void> {
  const cooldownKey = `COOLDOWN_GAPS#${baseUserId}`;
  try {
    const raw = await memory.getDistilledMemory(cooldownKey);
    const entries: Array<{ gapId: string; expiresAt: number }> = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    // Prune expired entries, then add the current gap
    const active = entries.filter((e) => e.expiresAt > now);
    active.push({ gapId, expiresAt: now + COOLDOWN_TTL_MS });
    await memory.updateDistilledMemory(cooldownKey, JSON.stringify(active));
  } catch (e) {
    logger.warn('Failed to record cooldown entry:', e);
  }
}
