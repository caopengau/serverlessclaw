/**
 * Generic interface for model registry operations.
 * Implementations can provide domain-specific model metadata and storage strategies.
 */
export interface ModelRegistry {
  /**
   * Retrieve the model registry payload for a workspace.
   * @param workspaceId The workspace identifier
   * @returns The registry data
   */
  read(workspaceId: string): Promise<ModelRegistryPayload>;

  /**
   * Update the model registry payload for a workspace.
   * @param workspaceId The workspace identifier
   * @param payload The updated registry data
   */
  write(workspaceId: string, payload: ModelRegistryPayload): Promise<void>;
}

/**
 * Generic model registry record structure.
 * Domains can extend this with additional fields.
 */
export interface ModelRegistryRecord {
  modelName?: string;
  source?: string;
  registeredAt?: string;
  metrics?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Generic model registry payload structure.
 * Domains can customize the shape while maintaining the base interface.
 */
export interface ModelRegistryPayload {
  models: Record<string, ModelRegistryRecord>;
  [key: string]: unknown;
}
