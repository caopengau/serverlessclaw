import { spawn, spawnSync } from 'child_process';
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
    const executionCwd = this.resolveExecutionCwd(spec.executor.cwd || '');

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

    const runtimeEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      WORKSPACE_ID: workspaceId,
      STAGING_BUCKET_NAME: process.env.STAGING_BUCKET_NAME || '',
      ...this.injectEnv(spec.executor.envOverrides || {}, run.inputsApplied),
    };

    // Prevent boto3 from trying to resolve an empty profile name like "()".
    if ((runtimeEnv.AWS_PROFILE || '').trim() === '') {
      delete runtimeEnv.AWS_PROFILE;
    }
    if ((runtimeEnv.AWS_DEFAULT_PROFILE || '').trim() === '') {
      delete runtimeEnv.AWS_DEFAULT_PROFILE;
    }

    // Spawn standard shell process
    const child = spawn(formattedCmd, {
      shell: resolvedShell,
      cwd: executionCwd,
      env: runtimeEnv,
    });

    const maxRuntimeMs = this.resolvePositiveInt(process.env.JOB_MAX_RUNTIME_MS, 45 * 60 * 1000);
    const idleTimeoutMs = this.resolvePositiveInt(process.env.JOB_IDLE_TIMEOUT_MS, 5 * 60 * 1000);

    let runtimeTimer: NodeJS.Timeout | null = null;
    let idleTimer: NodeJS.Timeout | null = null;

    const publishTimeoutLog = (reason: string) => {
      const text = `[JobExecutor] ${reason}\n`;
      const logTopic = `workspaces/${workspaceId}/jobs/${run.jobId}/logs`;
      publishToRealtime(logTopic, { text }).catch((err) => {
        logger.error(`[JobExecutor] Realtime log publish failed:`, err);
      });
    };

    const terminateProcess = (reason: string) => {
      if (child.exitCode !== null || child.killed) {
        return;
      }

      logger.warn(`[JobExecutor] ${reason} (job=${run.jobId})`);
      publishTimeoutLog(reason);
      child.kill('SIGTERM');

      setTimeout(() => {
        if (child.exitCode === null && !child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    };

    const clearIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const scheduleIdleTimer = () => {
      clearIdleTimer();
      idleTimer = setTimeout(() => {
        terminateProcess(
          `Idle timeout exceeded (${Math.floor(idleTimeoutMs / 1000)}s) without job output`
        );
      }, idleTimeoutMs) as NodeJS.Timeout;
    };

    runtimeTimer = setTimeout(() => {
      terminateProcess(`Max runtime exceeded (${Math.floor(maxRuntimeMs / 1000)}s)`);
    }, maxRuntimeMs) as NodeJS.Timeout;

    scheduleIdleTimer();

    let stdoutBuffer = '';

    // Handler to stream logs and scan metrics line by line
    const handleOutput = (data: Buffer) => {
      const text = data.toString();
      stdoutBuffer += text;
      scheduleIdleTimer();

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
      const errMsg = `Failed to spawn command process (shell=${resolvedShell}, cwd=${executionCwd}): ${err.message}\n`;
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
      if (runtimeTimer) {
        clearTimeout(runtimeTimer);
        runtimeTimer = null;
      }
      clearIdleTimer();

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
      '/bin/sh',
      '/usr/bin/sh',
      '/bin/bash',
      '/usr/bin/bash',
      process.env.SHELL,
    ].filter((value): value is string => Boolean(value));

    for (const shellPath of candidates) {
      if (!fs.existsSync(shellPath)) {
        continue;
      }

      // Some runtimes expose SHELL but cannot actually execute it. Probe once.
      const probe = spawnSync(shellPath, ['-lc', 'true'], {
        stdio: 'ignore',
        timeout: 1000,
      });

      if (!probe.error) {
        return shellPath;
      }
    }

    return null;
  }

  private static resolvePositiveInt(rawValue: string | undefined, fallback: number): number {
    if (!rawValue) {
      return fallback;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }

  /**
   * Resolve executor cwd robustly across monorepo package roots.
   * The dashboard can run from different working directories in local/dev runtimes.
   */
  private static resolveExecutionCwd(baseCwd: string): string {
    if (!baseCwd) {
      return process.cwd();
    }

    if (path.isAbsolute(baseCwd)) {
      return baseCwd;
    }

    const start = process.cwd();
    const ancestorRoots = [
      start,
      path.resolve(start, '..'),
      path.resolve(start, '../..'),
      path.resolve(start, '../../..'),
      path.resolve(start, '../../../..'),
    ];

    for (const root of ancestorRoots) {
      const candidate = path.resolve(root, baseCwd);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return path.resolve(start, baseCwd);
  }
}
