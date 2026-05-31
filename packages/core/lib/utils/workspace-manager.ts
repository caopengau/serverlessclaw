import { STORAGE } from '../constants';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { logger } from '../logger';
import { getStagingBucketName } from './resource-helpers';
import * as git from 'isomorphic-git';
import * as nodefs from 'fs';
import { SYSTEM } from '../constants/system';
import { createGunzip } from 'zlib';

/**
 * Extract a .tar.gz archive to a destination directory using Node.js built-ins.
 * Strips the first path component (equivalent to --strip-components=1).
 * This avoids a dependency on the `tar` CLI binary which is absent in Lambda.
 */
async function extractTarGz(archivePath: string, destDir: string): Promise<void> {
  const gzipped = await fs.readFile(archivePath);

  // Decompress gzip layer
  const decompressed = await new Promise<Buffer>((resolve, reject) => {
    const gunzip = createGunzip();
    const chunks: Buffer[] = [];
    gunzip.on('data', (chunk: Buffer) => chunks.push(chunk));
    gunzip.on('end', () => resolve(Buffer.concat(chunks)));
    gunzip.on('error', reject);
    gunzip.end(gzipped);
  });

  // Parse tar format (512-byte blocks)
  let offset = 0;
  while (offset + 512 <= decompressed.length) {
    const header = decompressed.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString('utf8').replace(/\0/g, '');
    if (!name) break;

    const sizeOctal = header.subarray(124, 136).toString('utf8').replace(/\0/g, '').trim();
    const size = parseInt(sizeOctal, 8) || 0;
    const typeFlag = String.fromCharCode(header[156]);

    offset += 512;

    // Strip first path component (repo-name-branch/ prefix from GitHub archives)
    const parts = name.split('/');
    const stripped = parts.slice(1).join('/');

    if (stripped) {
      const dest = path.join(destDir, stripped);
      if (typeFlag === '5' || name.endsWith('/')) {
        // Directory entry
        await fs.mkdir(dest, { recursive: true });
      } else if (typeFlag === '0' || typeFlag === '\0' || typeFlag === '') {
        // Regular file
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, decompressed.subarray(offset, offset + size));
      }
    }

    // Advance past file data, padded to 512-byte boundary
    offset += Math.ceil(size / 512) * 512;
  }
}

async function hydrateWorkspaceFromGitHub(workspacePath: string): Promise<void> {
  const pkgPath = path.join(workspacePath, 'package.json');
  if (nodefs.existsSync(pkgPath)) {
    return;
  }

  const repo = process.env.GITHUB_REPO || SYSTEM.DEFAULT_GITHUB_REPO;
  const ref = process.env.GITHUB_REF_NAME || 'main';
  const archiveUrl = `https://codeload.github.com/${repo}/tar.gz/refs/heads/${ref}`;
  const archivePath = path.join('/tmp', `workspace-source-${Date.now()}.tar.gz`);

  logger.warn(
    `[Workspace] package.json missing in copied bundle. Hydrating source from ${repo}@${ref}.`
  );

  const response = await fetch(archiveUrl, {
    headers: process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : undefined,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download repository archive: ${response.status} ${response.statusText}`
    );
  }

  const archiveBytes = await response.arrayBuffer();
  await fs.writeFile(archivePath, Buffer.from(archiveBytes));
  await fs.rm(workspacePath, { recursive: true, force: true });
  await fs.mkdir(workspacePath, { recursive: true });

  await extractTarGz(archivePath, workspacePath);
  await fs.rm(archivePath, { force: true });
  logger.info(`[Workspace] Hydration complete from ${repo}@${ref}.`);
}

/**
 * Common workspace setup logic.
 * Copies the deployment package to a writable /tmp directory and initializes Git.
 */
async function setupWorkspace(
  basePath: string,
  traceId: string,
  commitMsg: string,
  applyStagedChanges: boolean = false,
  stagingKey?: string
): Promise<string> {
  const workspacePath = `${basePath}-${traceId}-${Date.now()}`;
  await fs.rm(workspacePath, { recursive: true, force: true });

  // 1. Copy the deployment package (ignoring heavy/unnecessary folders)
  logger.info(`Copying workspace to ${workspacePath}...`);
  await fs.cp(process.cwd(), workspacePath, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(process.cwd(), src);
      return (
        !rel.startsWith('node_modules') &&
        !rel.startsWith('.sst') &&
        !rel.startsWith('.git') &&
        !rel.startsWith('.next') &&
        !rel.startsWith('coverage') &&
        !rel.startsWith('.turbo')
      );
    },
  });

  try {
    await hydrateWorkspaceFromGitHub(workspacePath);
  } catch (error) {
    logger.warn(`Failed to hydrate workspace from GitHub: ${error}`);
  }

  // 2. Fix Read-Only permissions inherited from Lambda's /var/task
  try {
    execSync(`chmod -R u+w "${workspacePath}"`, { stdio: 'ignore' });
  } catch {
    // Ignore errors if chmod fails (e.g., on some OSes or already writable)
  }

  // 3. Symlink node_modules for test execution
  // We symlink instead of copy to save space and time in /tmp.
  try {
    const targetNodeModules = path.join(process.cwd(), 'node_modules');
    const wsNodeModules = path.join(workspacePath, 'node_modules');
    await fs.symlink(targetNodeModules, wsNodeModules, 'dir');
  } catch (error) {
    logger.warn(`Failed to symlink node_modules to workspace: ${error}`);
  }

  // 4. Initialize Git and create the base commit
  // Required because Coder Agent tools like generatePatch need a Git repo.
  // We also configure a local user to avoid "Author identity unknown" errors.
  try {
    // Attempt system git first (fastest)
    try {
      execSync(
        `git init -q && git config user.email "agent@claw.local" && git config user.name "Claw Agent" && git add -A && git commit -q -m "${commitMsg}"`,
        { cwd: workspacePath, encoding: 'utf-8', timeout: 30000 }
      );
      logger.info('Initialized git workspace using system git.');
    } catch (gitError) {
      logger.warn(`System git failed, falling back to isomorphic-git: ${gitError}`);
      // Fallback to isomorphic-git (works in serverless environments)
      await git.init({ fs: nodefs, dir: workspacePath });
      await git.add({ fs: nodefs, dir: workspacePath, filepath: '.' });
      await git.commit({
        fs: nodefs,
        dir: workspacePath,
        author: { name: 'Claw Agent', email: 'agent@claw.local' },
        message: commitMsg,
      });
      logger.info('Initialized git workspace using isomorphic-git.');
    }
  } catch (error) {
    logger.error(`Failed to initialize git in workspace: ${error}`);
    throw new Error(
      `WORKSPACE_GIT_INIT_FAILED: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // 5. Apply staged changes from S3 if requested (fixes parallel/merger build failures)
  // We do this AFTER git init so these changes appear as unstaged modifications.
  // This ensures stageChanges will re-upload them alongside the agent's new fixes.
  if (applyStagedChanges) {
    try {
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const stagingBucket = getStagingBucketName();

      if (stagingBucket) {
        const s3Client = new S3Client({});
        const zipKey = stagingKey || (traceId ? `staged_${traceId}.zip` : STORAGE.STAGING_ZIP);
        logger.info(`Fetching staged changes from S3 bucket: ${stagingBucket} (Key: ${zipKey})`);
        const response = await s3Client.send(
          new GetObjectCommand({
            Bucket: stagingBucket,
            Key: zipKey,
          })
        );

        if (response.Body) {
          const zipPath = path.join(workspacePath, 'staged_changes.zip');
          const fileBuffer = await response.Body.transformToByteArray();
          await fs.writeFile(zipPath, Buffer.from(fileBuffer));

          logger.info(`Applying staged changes to workspace...`);
          execSync(`unzip -o staged_changes.zip && rm staged_changes.zip`, {
            cwd: workspacePath,
            stdio: 'ignore',
          });
        }
      }
    } catch (e) {
      logger.warn(`Failed to apply staged changes to workspace: ${e}`);
    }
  }

  return workspacePath;
}

/**
 * Creates a writable agent workspace in /tmp.
 */
export async function createWorkspace(
  traceId: string,
  applyStagedChanges: boolean = false,
  stagingKey?: string
): Promise<string> {
  return setupWorkspace(
    STORAGE.WORKSPACE_BASE,
    traceId,
    'workspace init',
    applyStagedChanges,
    stagingKey
  );
}

/**
 * Creates a writable merger workspace in /tmp.
 */
export async function createMergeWorkspace(traceId: string): Promise<string> {
  return setupWorkspace(STORAGE.MERGE_BASE, traceId, 'merge base');
}

/**
 * Removes an ephemeral workspace.
 */
export async function cleanupWorkspace(wsPath: string): Promise<void> {
  if (wsPath.startsWith('/tmp/workspace-') || wsPath.startsWith('/tmp/merge-')) {
    await fs.rm(wsPath, { recursive: true, force: true }).catch((e) => {
      logger.warn(`Failed to cleanup workspace ${wsPath}: ${e}`);
    });
  }
}
