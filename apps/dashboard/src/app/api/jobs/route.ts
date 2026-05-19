import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth-utils';
import { JobStore } from '@claw/core/lib/jobs/store';
import { JobExecutorService } from '@claw/core/lib/jobs/executor';
import { JobSpec, JobRun } from '@claw/core/lib/jobs/types';
import { logger } from '@claw/core/lib/logger';
import { HTTP_STATUS } from '@claw/core/lib/constants';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * Dynamically resolves and loads jobs.config.json from candidate paths
 * to prevent leaking domain-specific logic into the Serverless Claw core.
 */
function loadJobsConfig(): JobSpec[] {
  const candidatePaths = [
    // 1. Path provided by environment variable
    process.env.JOBS_CONFIG_PATH ? path.resolve(process.cwd(), process.env.JOBS_CONFIG_PATH) : '',
    // 2. NextJS CWD (usually root of the dashboard app)
    path.join(process.cwd(), 'jobs.config.json'),
    // 3. Monorepo root fallback candidates
    path.resolve(process.cwd(), '../../jobs.config.json'),
    path.resolve(process.cwd(), '../../../jobs.config.json'),
  ].filter(Boolean) as string[];

  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          logger.info(`[Jobs API] Successfully loaded ${parsed.length} specifications from config: ${filePath}`);
          return parsed as JobSpec[];
        }
      } catch (err) {
        logger.error(`[Jobs API] Error parsing config file at ${filePath}:`, err);
      }
    }
  }

  logger.warn('[Jobs API] No jobs.config.json found in candidate paths. Running with empty specifications.');
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

    // 1. Dynamic Seeding: Load local jobs config and save to store
    const specsFromConfig = loadJobsConfig();
    for (const spec of specsFromConfig) {
      await store.saveJobSpec(workspaceId, spec);
    }

    // 2. Fetch specs and runs from database
    const specs = await store.listJobSpecs(workspaceId);
    const runs = await store.listJobRuns(workspaceId);

    return NextResponse.json({
      specs,
      runs
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

    // 1. Fetch target specification
    const spec = await store.getJobSpec(workspaceId, jobType);
    if (!spec) {
      return NextResponse.json(
        { error: `Job Specification of type '${jobType}' not found in database.` },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    // 2. Formulate Job Run
    const jobId = 'jr_' + Math.random().toString(36).substring(2, 15);
    const run: JobRun = {
      jobId,
      jobType,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      triggeredBy: userId,
      inputsApplied: inputs,
      metrics: {}
    };

    // 3. Save run to the store in PENDING state
    await store.createJobRun(workspaceId, run);

    // 4. Asynchronously trigger background subprocess execution
    JobExecutorService.startLocalJob(workspaceId, spec, run).catch((err) => {
      logger.error(`[Jobs API] Execution failed to launch for job ${jobId}:`, err);
    });

    return NextResponse.json(
      { success: true, run },
      { status: HTTP_STATUS.CREATED }
    );
  } catch (error) {
    logger.error('[Jobs API] POST Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: String(error) },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
