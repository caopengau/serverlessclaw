import { ModelRegistry, ModelRegistryPayload } from '@claw/core/lib/models/registry.interface';
import { logger } from '@claw/core/lib/logger';

class DefaultModelRegistry implements ModelRegistry {
  async read(_workspaceId: string): Promise<ModelRegistryPayload> {
    return { models: {} };
  }

  async write(_workspaceId: string, _payload: ModelRegistryPayload): Promise<void> {
    // No-op
  }
}

export let modelRegistry: ModelRegistry = new DefaultModelRegistry();

export function setModelRegistry(registry: ModelRegistry): void {
  modelRegistry = registry;
  logger.info('[Models API] Custom model registry registered');
}
