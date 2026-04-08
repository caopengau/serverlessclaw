import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import { GitHubIssueResolverAgent } from '@serverlessclaw/core/growth/GitHubIssueResolverAgent';

export interface CLISyncOptions {
  hub: string;
  prefix: string;
  workingDir: string;
}

/**
 * The CLI sync command mirrors the managed SyncOrchestrator logic
 * for decentralized OSS use cases.
 */
export async function runSync(options: CLISyncOptions) {
  const { hub, prefix, workingDir } = options;
  const hubUrl = `https://github.com/${hub}.git`;
  const hubRemote = 'hub-origin';

  console.log(`[Claw Sync] Syncing ${workingDir} with Hub: ${hubUrl}...`);

  try {
    // 1. Ensure remote exists
    ensureRemote(workingDir, hubRemote, hubUrl);

    // 2. Fetch and Subtree Pull
    console.log(`[Claw Sync] Fetching updates...`);
    execSync(`git fetch ${hubRemote} main`, { cwd: workingDir });

    try {
      execSync(
        `git subtree pull --prefix=${prefix} ${hubRemote} main --squash -m "chore: sync with serverlessclaw hub"`,
        { cwd: workingDir, stdio: 'inherit' }
      );
    } catch (error) {
       console.warn(`[Claw Sync] Conflict detected. OSS users should resolve conflicts manually or use the Resolver Agent.`);
       // Optionally trigger resolver here if LLM keys are provided
    }

    console.log(`[Claw Sync] Sync complete.`);
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
