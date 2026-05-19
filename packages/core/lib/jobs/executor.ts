import { spawn } from 'child_process';
import { JobSpec, JobRun, JobStatus } from './types';
import { JobStore } from './store';
import { MetricsParser } from './parser';
import { publishToRealtime } from '../utils/realtime';
import { logger } from '../logger';

export class JobExecutorService {
  /**
   * Spawns a background process for a generic JobRun.
   * Substitutes template placeholders in the command template with values from inputsApplied.
   * Streams outputs to real-time subscribers and scans for scalar metrics on the fly.
   */
  static async startLocalJob(workspaceId: string, spec: JobSpec, run: JobRun): Promise<void> {
    const store = JobStore.getInstance();

    // 1. Resolve the command with inputs applied
    const rawCmd = spec.executor.command;
    const formattedCmd = this.injectInputs(rawCmd, run.inputsApplied);

    logger.info(`[JobExecutor] Spawning job ${run.jobId} command: "${formattedCmd}"`);

    // 2. Set the status of the run to RUNNING
    run.status = 'RUNNING';
    run.startedAt = new Date().toISOString();
    await store.updateJobRun(workspaceId, run, {
      status: 'RUNNING',
      startedAt: run.startedAt,
    });

    // 3. Resolve execution CWD and environment variables
    const baseCwd = spec.executor.cwd || '';
    // Resolve absolute path for workspace alignment if needed
    const executionCwd = baseCwd.startsWith('/') ? baseCwd : `${process.cwd()}/${baseCwd}`;

    // Spawn standard shell process
    const child = spawn(formattedCmd, {
      shell: true,
      cwd: executionCwd,
      env: {
        ...process.env,
        ...this.injectEnv(spec.executor.envOverrides || {}, run.inputsApplied),
      },
    });

    let stdoutBuffer = '';

    // Handler to stream logs and scan metrics line by line
    const handleOutput = (data: Buffer) => {
      const text = data.toString();
      stdoutBuffer += text;

      // Publish raw log chunk to realtime
      const logTopic = `workspaces/${workspaceId}/jobs/${run.jobId}/logs`;
      publishToRealtime(logTopic, { text }).catch((err) => {
        logger.error(`[JobExecutor] Realtime log publish failed:`, err);
      });

      // Parse output for metrics on the fly
      const parsedMetrics = MetricsParser.scan(text, spec.metricsSchema);
      if (Object.keys(parsedMetrics).length > 0) {
        logger.info(
          `[JobExecutor] Extracted real-time metrics for job ${run.jobId}:`,
          parsedMetrics
        );
        run.metrics = {
          ...run.metrics,
          ...parsedMetrics,
        };
        store
          .updateJobRun(workspaceId, run, {
            metrics: run.metrics,
          })
          .catch((err) => {
            logger.error(`[JobExecutor] Failed to update metrics in db:`, err);
          });
      }
    };

    child.stdout.on('data', handleOutput);
    child.stderr.on('data', handleOutput);

    child.on('close', async (code) => {
      const finalStatus: JobStatus = code === 0 ? 'COMPLETED' : 'FAILED';
      run.status = finalStatus;
      run.completedAt = new Date().toISOString();

      logger.info(
        `[JobExecutor] Job ${run.jobId} closed with exit code ${code}. Final status: ${finalStatus}`
      );

      // Perform a final scan of the entire buffer for any late-emitted metrics
      const finalMetrics = MetricsParser.scan(stdoutBuffer, spec.metricsSchema);
      run.metrics = {
        ...run.metrics,
        ...finalMetrics,
      };

      await store.updateJobRun(workspaceId, run, {
        status: finalStatus,
        completedAt: run.completedAt,
        metrics: run.metrics,
      });

      // Broadcast job status change completion signal
      const statusTopic = `workspaces/${workspaceId}/jobs/${run.jobId}/status`;
      publishToRealtime(statusTopic, { status: finalStatus, metrics: run.metrics }).catch((err) => {
        logger.error(`[JobExecutor] Realtime status publish failed:`, err);
      });
    });
  }

  /**
   * Helper to replace {{inputName}} placeholders with dynamic parameter inputs in strings.
   */
  private static injectInputs(template: string, inputs: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(inputs)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return result;
  }

  /**
   * Helper to replace env variables values if they contain placeholders.
   */
  private static injectEnv(
    envOverrides: Record<string, string>,
    inputs: Record<string, any>
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(envOverrides)) {
      result[key] = this.injectInputs(value, inputs);
    }
    return result;
  }
}
