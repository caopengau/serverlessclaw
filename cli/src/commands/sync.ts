/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import { GitHubIssueResolverAgent } from '@serverlessclaw/integration-github/src/agents/GitHubIssueResolverAgent';

export interface CLISyncOptions {
  hub: string;
  prefix: string;
  workingDir: string;
  method: 'subtree' | 'fork';
}

/**
 * The CLI sync command mirrors the managed SyncOrchestrator logic
 * for decentralized OSS use cases.
 */
export async function runSync(options: CLISyncOptions) {
  const { hub, prefix, workingDir, method = 'subtree' } = options;
  const hubUrl = `https://github.com/${hub}.git`;
  const hubRemote = 'hub-origin';

  console.log(`[Claw Sync] Syncing ${workingDir} with Hub: ${hubUrl} using ${method} method...`);

  try {
    // 1. Ensure remote exists
    ensureRemote(workingDir, hubRemote, hubUrl);

    // 2. Fetch updates
    console.log(`[Claw Sync] Fetching updates from ${hubRemote}...`);
    execSync(`git fetch ${hubRemote} main`, { cwd: workingDir });

    if (method === 'fork') {
      // Standard Fork Sync: Merge from upstream/main
      console.log(`[Claw Sync] Merging changes from ${hubRemote}/main...`);
      try {
        execSync(
          `git merge ${hubRemote}/main -m "chore: sync with serverlessclaw hub via fork merge"`,
          {
            cwd: workingDir,
            stdio: 'inherit',
            env: { ...process.env, GIT_MERGE_AUTOEDIT: 'no' },
          }
        );
      } catch (mergeError) {
        console.warn(`[Claw Sync] Merge conflicts detected. Please resolve manually.`);
      }
    } else {
      // Subtree Sync: Pull using subtree prefix
      console.log(`[Claw Sync] Pulling subtree updates for prefix ${prefix}...`);
      try {
        execSync(
          `git subtree pull --prefix=${prefix} ${hubRemote} main --squash -m "chore: sync with serverlessclaw hub via subtree"`,
          { cwd: workingDir, stdio: 'inherit', env: { ...process.env, GIT_MERGE_AUTOEDIT: 'no' } }
        );
      } catch (error) {
        console.warn(`[Claw Sync] Conflict detected during subtree pull. Please resolve manually.`);
      }
    }

    console.log(`[Claw Sync] Sync process complete.`);
  } catch (error: any) {
    console.error(`[Claw Sync] Failed: ${error.message}`);
    process.exit(1);
  }
}

function ensureRemote(cwd: string, name: string, url: string): void {
  try {
    execSync(`git remote add ${name} ${url}`, { cwd, stdio: 'ignore' });
  } catch (e: any) {
    execSync(`git remote set-url ${name} ${url}`, { cwd, stdio: 'ignore' });
  }
}
