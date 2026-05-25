import { ModelRegistry, ModelRegistryPayload } from '@claw/core/lib/models/registry.interface';
import { logger } from '@claw/core/lib/logger';

/**
 * Default model registry that returns empty records.
 * Can be replaced with a domain-specific implementation (e.g., GoldexModelRegistry).
 */
class DefaultModelRegistry implements ModelRegistry {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async read(_workspaceId: string): Promise<ModelRegistryPayload> {
    return { models: {} };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async write(_workspaceId: string, _payload: ModelRegistryPayload): Promise<void> {
    // No-op
  }
}

/**
 * Optional custom model registry implementation.
 * Can be replaced with a domain-specific implementation (e.g., GoldexModelRegistry).
 * Defaults to a no-op registry if not provided.
 */
let modelRegistry: ModelRegistry = new DefaultModelRegistry();

/**
 * Set custom model registry implementation.
 * This allows domain-specific implementations to be injected.
 */
export function setModelRegistry(registry: ModelRegistry): void {
  modelRegistry = registry;
  logger.info('[Models API] Custom model registry registered');
}

export function getModelRegistry(): ModelRegistry {
  return modelRegistry;
}
