import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth-utils';
import { JobStore } from '@claw/core/lib/jobs/store';
import { JobExecutorService } from '@claw/core/lib/jobs/executor';
import { JobSpec, JobRun } from '@claw/core/lib/jobs/types';
import {
  JobInputNormalizer,
  DefaultJobInputNormalizer,
} from '@claw/core/lib/jobs/normalizer.interface';
import { logger } from '@claw/core/lib/logger';
import { HTTP_STATUS } from '@claw/core/lib/constants';
import fs from 'fs';
import path from 'path';
import defaultJobsConfig from 'virtual-jobs-config';

export const dynamic = 'force-dynamic';

/**
 * Optional custom job input normalizer for domain-specific transformations.
 * Can be replaced with a domain-specific implementation (e.g., CustomJobInputNormalizer).
 * Defaults to a pass-through normalizer if not provided.
 */
let jobInputNormalizer: JobInputNormalizer = new DefaultJobInputNormalizer();

/**
 * Set custom job input normalizer.
 * This allows domain-specific implementations to be injected.
 */
function setJobInputNormalizer(normalizer: JobInputNormalizer): void {
  jobInputNormalizer = normalizer;
  logger.info('[Jobs API] Custom job input normalizer registered');
}

/**
 * Dynamically resolves and loads jobs.config.json from the virtual webpack alias
 * to prevent leaking domain-specific logic into the Serverless Claw core,
 * and to guarantee availability in the Open-Next deployed Lambda environment.
 */
function loadJobsConfig(): JobSpec[] {
  try {
    let configData: unknown = defaultJobsConfig;
    if (
      configData &&
      typeof configData === 'object' &&
      !Array.isArray(configData) &&
      'default' in configData
    ) {
      configData = (configData as Record<string, unknown>).default;
    }

    if (Array.isArray(configData)) {
      const specs = configData as unknown as JobSpec[];
      logger.info(
        `[Jobs API] Successfully loaded ${specs.length} specifications from virtual-jobs-config`
      );
      return specs;
    } else {
      logger.warn(
        '[Jobs API] virtual-jobs-config did not export an array, returning empty specs list.'
      );
    }
  } catch (e) {
    logger.error('[Jobs API] Failed to parse virtual-jobs-config:', e);
  }

  logger.warn(
    '[Jobs API] No jobs.config.json found via virtual module. Running with empty specifications.'
  );
  return [];
}

/**
 * GET /api/jobs
 * Returns all registered Job Specifications and historical Job Runs in the workspace.
 * Automatically triggers database seeding from jobs.config.json if changes are detected.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const workspaceId = req.nextUrl.searchParams.get('workspaceId') || 'default';
    const userId = getUserId(req);

    // Verify workspace access and task viewing permission
    const { getIdentityManager, Permission } = await import('@claw/core/lib/session/identity');
    const identityManager = await getIdentityManager();

    const hasPermission = await identityManager.hasPermission(
      userId,
      Permission.TASK_CREATE, // Use TASK_CREATE as gate for pipeline actions
      workspaceId
    );
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Unauthorized workspace access or missing pipeline permission' },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    const store = JobStore.getInstance();

    // 1. Load local jobs config
    const specs = loadJobsConfig();

    // 2. Fetch runs from database
    const runs = await store.listJobRuns(workspaceId);

    return NextResponse.json({
      specs,
      runs,
    });
  } catch (error) {
    logger.error('[Jobs API] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: String(error) },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}

/**
 * Verifies if a given model file exists in S3 (deployed) or the local workspace (local development).
 */
async function checkModelFileExists(
  workspaceId: string,
  spec: JobSpec,
  inputs: Record<string, unknown>
): Promise<boolean> {
  const outputPath = spec.executor.outputPath;
  if (!outputPath) return true; // If no output verification configured, skip and proceed

  const resolvedRelativePath = JobExecutorService.injectInputs(outputPath, inputs);
  const bucketName = process.env.STAGING_BUCKET_NAME;

  if (bucketName) {
    const filename = path.basename(resolvedRelativePath);
    try {
      const { S3Client, HeadObjectCommand } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({});
      await s3.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: `workspaces/${workspaceId}/models/${filename}`,
        })
      );
      return true;
    } catch (err) {
      const s3Error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (s3Error.name === 'NotFound' || s3Error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      logger.error(`[Jobs API] S3 HeadObject failed for ${filename}:`, err);
      return false;
    }
  } else {
    const cwd = spec.executor.cwd || '';
    const pathsToCheck = [
      path.resolve(process.cwd(), cwd, resolvedRelativePath),
      path.resolve(process.cwd(), resolvedRelativePath),
      path.resolve(process.cwd(), '../../', cwd, resolvedRelativePath),
    ];
    for (const p of pathsToCheck) {
      if (fs.existsSync(p)) {
        return true;
      }
    }
    return false;
  }
}

/**
 * POST /api/jobs
 * Triggers execution of a background training/simulation pipeline.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const workspaceId = req.nextUrl.searchParams.get('workspaceId') || 'default';
    const userId = getUserId(req);
    const { jobType, inputs = {} } = await req.json();

    if (!jobType) {
      return NextResponse.json(
        { error: 'Missing parameter: jobType' },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    // Verify workspace access
    const { getIdentityManager, Permission } = await import('@claw/core/lib/session/identity');
    const identityManager = await getIdentityManager();

    const hasPermission = await identityManager.hasPermission(
      userId,
      Permission.TASK_CREATE,
      workspaceId
    );
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Unauthorized workspace access or missing pipeline permission' },
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    const store = JobStore.getInstance();

    // 1. Fetch target specification from config
    const specs = loadJobsConfig();
    const spec = specs.find((s) => s.jobType === jobType);
    if (!spec) {
      return NextResponse.json(
        { error: `Job Specification of type '${jobType}' not found in configuration.` },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    // 2. Normalize job inputs using the registered normalizer (domain-specific transformations)
    const normalizedInputs = jobInputNormalizer.normalize(spec, inputs as Record<string, unknown>);

    // 3. Cache Matching Layer: Avoid retraining if parameters match and the file exists in storage
    if (spec.executor.outputPath) {
      const pastRuns = await store.listJobRuns(workspaceId);
      const duplicateRun = pastRuns.find(
        (r) =>
          r.jobType === jobType &&
          r.status === 'COMPLETED' &&
          JSON.stringify(r.inputsApplied) === JSON.stringify(normalizedInputs)
      );

      if (duplicateRun) {
        const fileExists = await checkModelFileExists(workspaceId, spec, normalizedInputs);
        if (fileExists) {
          logger.info(
            `[Jobs API] Cache Hit! Reusing existing completed model for inputs:`,
            normalizedInputs
          );
          return NextResponse.json(
            {
              success: true,
              run: duplicateRun,
              message: 'Reused existing cached model (bypassed retraining)',
            },
            { status: HTTP_STATUS.OK }
          );
        }
      }
    }

    // 3. Formulate Job Run
    const jobId = 'jr_' + Math.random().toString(36).substring(2, 15);
    const run: JobRun = {
      jobId,
      jobType,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      triggeredBy: userId,
      inputsApplied: normalizedInputs,
      metrics: {},
    };

    // 4. Save run to the store in PENDING state
    await store.createJobRun(workspaceId, run);

    // 5. Asynchronously trigger background subprocess execution
    JobExecutorService.startLocalJob(workspaceId, spec, run).catch((err) => {
      logger.error(`[Jobs API] Execution failed to launch for job ${jobId}:`, err);
    });

    return NextResponse.json({ success: true, run }, { status: HTTP_STATUS.CREATED });
  } catch (error) {
    logger.error('[Jobs API] POST Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: String(error) },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
