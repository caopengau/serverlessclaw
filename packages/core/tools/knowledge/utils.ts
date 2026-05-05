import { DynamoMemory } from '../../lib/memory';

/**
 * Lazy-load memory with instance reuse for knowledge tools.
 */
let cachedMemory: DynamoMemory | undefined;

export function getMemory(): DynamoMemory {
  if (!cachedMemory) {
    cachedMemory = new DynamoMemory();
  }
  return cachedMemory;
}
