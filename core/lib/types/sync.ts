/**
 * Core interface for repository synchronization (Subtree/Fork).
 * This abstraction allows sensors (GitHub, Jira, etc.) to trigger syncs
 * through a unified platform-agnostic interface.
 */
export interface SyncOrchestrator {
  /**
   * Performs a pull from the Mother Hub.
   * @param options - Configuration for the pull operation.
   */
  pull(options: SyncOptions): Promise<SyncResult>;

  /**
   * Performs a push back to the Mother Hub (typically for verified contributions).
   * @param options - Configuration for the push operation.
   */
  push(options: SyncOptions): Promise<SyncResult>;

  /**
   * Checks for synchronization health and potential conflicts.
   */
  verify(options: SyncOptions): Promise<SyncVerification>;
}

export type SyncMethod = 'subtree' | 'fork';

export interface SyncOptions {
  hubUrl: string;
  prefix?: string;
  method: SyncMethod;
  commitMessage: string;
  gapIds?: string[];
  traceId?: string;
  /** Whether to dry-run the sync for validation. */
  dryRun?: boolean;
}

export interface SyncResult {
  success: boolean;
  message: string;
  commitHash?: string;
  conflicts?: SyncConflict[];
  buildId?: string;
}

export interface SyncVerification {
  ok: boolean;
  reachable: boolean;
  canSyncWithoutConflict: boolean;
  message?: string;
}

export interface SyncConflict {
  file: string;
  type: 'content' | 'delete' | 'permission';
  description: string;
}
