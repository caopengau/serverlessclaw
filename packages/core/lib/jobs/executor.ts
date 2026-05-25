import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
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
    let executionCwd = baseCwd;
    if (!baseCwd.startsWith('/')) {
      const localPath = path.resolve(process.cwd(), baseCwd);
      const parentPath = path.resolve(process.cwd(), '../../', baseCwd);
      if (fs.existsSync(localPath)) {
        executionCwd = localPath;
      } else if (fs.existsSync(parentPath)) {
        executionCwd = parentPath;
      } else {
        executionCwd = localPath; // fallback
      }
    }

    const resolvedShell = this.resolveShellPath();
    if (!resolvedShell) {
      const errMsg =
        'Failed to spawn command process: no executable shell found. Checked SHELL, /bin/sh, /usr/bin/sh, /bin/bash, /usr/bin/bash.\n';
      logger.error(`[JobExecutor] ${errMsg.trim()}`);

      const logTopic = `workspaces/${workspaceId}/jobs/${run.jobId}/logs`;
      publishToRealtime(logTopic, { text: errMsg }).catch((pubErr) => {
        logger.error(`[JobExecutor] Realtime log publish failed:`, pubErr);
      });

      run.status = 'FAILED';
      run.completedAt = new Date().toISOString();
      await store.updateJobRun(workspaceId, run, {
        status: 'FAILED',
        completedAt: run.completedAt,
      });

      const statusTopic = `workspaces/${workspaceId}/jobs/${run.jobId}/status`;
      publishToRealtime(statusTopic, { status: 'FAILED', metrics: run.metrics }).catch((pubErr) => {
        logger.error(`[JobExecutor] Realtime status publish failed:`, pubErr);
      });
      return;
    }

    // Spawn standard shell process
    const child = spawn(formattedCmd, {
      shell: resolvedShell,
      cwd: executionCwd,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        WORKSPACE_ID: workspaceId,
        STAGING_BUCKET_NAME: process.env.STAGING_BUCKET_NAME || '',
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

    // Register error handler to catch execution/spawn failures and mark job as FAILED
    child.on('error', (err) => {
      logger.error(`[JobExecutor] Process spawn error for job ${run.jobId}:`, err);
      const errMsg = `Failed to spawn command process (shell=${resolvedShell}): ${err.message}\n`;
      const logTopic = `workspaces/${workspaceId}/jobs/${run.jobId}/logs`;
      publishToRealtime(logTopic, { text: errMsg }).catch((pubErr) => {
        logger.error(`[JobExecutor] Realtime log publish failed:`, pubErr);
      });
      run.status = 'FAILED';
      run.completedAt = new Date().toISOString();
      store
        .updateJobRun(workspaceId, run, {
          status: 'FAILED',
          completedAt: run.completedAt,
        })
        .catch((dbErr) => {
          logger.error(`[JobExecutor] Failed to update job status to FAILED in DB:`, dbErr);
        });

      const statusTopic = `workspaces/${workspaceId}/jobs/${run.jobId}/status`;
      publishToRealtime(statusTopic, { status: 'FAILED', metrics: run.metrics }).catch((pubErr) => {
        logger.error(`[JobExecutor] Realtime status publish failed:`, pubErr);
      });
    });

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
  public static injectInputs(template: string, inputs: Record<string, unknown>): string {
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
    inputs: Record<string, unknown>
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(envOverrides)) {
      result[key] = this.injectInputs(value, inputs);
    }
    return result;
  }

  /**
   * Resolve a shell executable path that exists in the current runtime.
   * Some serverless runtimes do not provide /bin/sh, so we probe alternatives.
   */
  private static resolveShellPath(): string | null {
    const candidates = [
      process.env.SHELL,
      '/bin/sh',
      '/usr/bin/sh',
      '/bin/bash',
      '/usr/bin/bash',
    ].filter((value): value is string => Boolean(value));

    for (const shellPath of candidates) {
      if (fs.existsSync(shellPath)) {
        return shellPath;
      }
    }

    return null;
  }
}
