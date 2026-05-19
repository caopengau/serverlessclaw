import { BaseMemoryProvider } from '../memory/base';
import { JobSpec, JobRun } from './types';
import { logger } from '../logger';

export class JobStore extends BaseMemoryProvider {
  private static _instance: JobStore | undefined;

  static getInstance(): JobStore {
    if (!this._instance) {
      this._instance = new JobStore();
    }
    return this._instance;
  }

  /**
   * Saves or updates a Job Specification in the MemoryTable.
   */
  async saveJobSpec(workspaceId: string, spec: JobSpec): Promise<void> {
    const pk = `WS#${workspaceId}#JOBSPEC`;
    const sk = `SPEC#${spec.jobType}`;

    logger.info(`[JobStore] Saving JobSpec: ${spec.jobType} in workspace: ${workspaceId}`);

    await this.putItem({
      userId: pk,
      timestamp: sk,
      ...spec,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Retrieves a Job Specification by type.
   */
  async getJobSpec(workspaceId: string, jobType: string): Promise<JobSpec | undefined> {
    const pk = `WS#${workspaceId}#JOBSPEC`;
    const sk = `SPEC#${jobType}`;

    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    try {
      const response = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName || '',
          Key: { userId: pk, timestamp: sk },
        })
      );
      return response.Item as JobSpec | undefined;
    } catch (error) {
      logger.error(`[JobStore] Error getting JobSpec ${jobType}:`, error);
      return undefined;
    }
  }

  /**
   * Lists all Job Specifications registered for a workspace.
   */
  async listJobSpecs(workspaceId: string): Promise<JobSpec[]> {
    const pk = `WS#${workspaceId}#JOBSPEC`;
    try {
      const items = await this.queryItems({
        KeyConditionExpression: 'userId = :pk AND begins_with(#ts, :prefix)',
        ExpressionAttributeNames: {
          '#ts': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':pk': pk,
          ':prefix': 'SPEC#',
        },
      });
      return items as unknown as JobSpec[];
    } catch (error) {
      logger.error(`[JobStore] Error listing JobSpecs for workspace ${workspaceId}:`, error);
      return [];
    }
  }

  /**
   * Creates a new Job Run item in the MemoryTable.
   */
  async createJobRun(workspaceId: string, run: JobRun): Promise<void> {
    const pk = `WS#${workspaceId}#JOBRUN`;
    const sk = `RUN#${run.jobType}#${run.createdAt}#${run.jobId}`;

    logger.info(`[JobStore] Creating JobRun: ${run.jobId} of type: ${run.jobType}`);

    await this.putItem({
      userId: pk,
      timestamp: sk,
      ...run,
    });
  }

  /**
   * Updates an existing Job Run item.
   */
  async updateJobRun(
    workspaceId: string,
    run: JobRun,
    updates: Partial<Omit<JobRun, 'jobId' | 'jobType' | 'createdAt'>>
  ): Promise<void> {
    const pk = `WS#${workspaceId}#JOBRUN`;
    const sk = `RUN#${run.jobType}#${run.createdAt}#${run.jobId}`;

    logger.info(`[JobStore] Updating JobRun: ${run.jobId} of type: ${run.jobType}`);

    const mergedRun = {
      ...run,
      ...updates,
      userId: pk,
      timestamp: sk,
    };

    await this.putItem(mergedRun as any);
  }

  /**
   * Queries historical Job Runs for a workspace, optionally filtered by type.
   */
  async listJobRuns(workspaceId: string, jobType?: string): Promise<JobRun[]> {
    const pk = `WS#${workspaceId}#JOBRUN`;
    const prefix = jobType ? `RUN#${jobType}#` : 'RUN#';
    try {
      const items = await this.queryItems({
        KeyConditionExpression: 'userId = :pk AND begins_with(#ts, :prefix)',
        ExpressionAttributeNames: {
          '#ts': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':pk': pk,
          ':prefix': prefix,
        },
      });
      // Sort chronologically descending (newest first)
      const sorted = (items as unknown as JobRun[]).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return sorted;
    } catch (error) {
      logger.error(`[JobStore] Error listing JobRuns for workspace ${workspaceId}:`, error);
      return [];
    }
  }

  /**
   * Finds a specific Job Run by its jobId.
   * Since the sort key includes the creation timestamp, we can query by prefix if we don't know the timestamp.
   * But a robust way is to query all runs and filter, or query with a GSI if available.
   * Since this is a lightweight operation, we can query prefix `RUN#` and scan for the matching jobId.
   */
  async getJobRun(workspaceId: string, jobId: string): Promise<JobRun | undefined> {
    const runs = await this.listJobRuns(workspaceId);
    return runs.find((r) => r.jobId === jobId);
  }
}
