import { ModelRegistry, ModelRegistryPayload } from '@claw/core/lib/models/registry.interface';
import { PluginManager } from '@claw/core/lib/plugin-manager';
import { logger } from '@claw/core/lib/logger';

class DefaultModelRegistry implements ModelRegistry {
  async read(_workspaceId: string): Promise<ModelRegistryPayload> {
    return { models: {} };
  }

  async write(_workspaceId: string, _payload: ModelRegistryPayload): Promise<void> {
    // No-op
  }
}

/**
 * Resolves the model registry. 
 * Prioritizes plugin-registered registries, falling back to a default implementation.
 */
export const modelRegistry: ModelRegistry = new Proxy({} as ModelRegistry, {
  get: (_target, prop, receiver) => {
    const registry = PluginManager.getModelRegistry() || new DefaultModelRegistry();
    return Reflect.get(registry, prop, receiver);
  }
});

/**
 * @deprecated Use PluginManager.register() to register a custom model registry.
 */
export function setModelRegistry(_registry: ModelRegistry): void {
  logger.warn('[Models API] setModelRegistry is deprecated. Register via PluginManager instead.');
}
