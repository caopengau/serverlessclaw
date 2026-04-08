import { SyncOrchestrator, SyncOptions, SyncResult, SyncVerification } from '../types/sync';
import { execSync } from 'child_process';
import { logger } from '../logger';

export class DefaultSyncOrchestrator implements SyncOrchestrator {
  private async execGit(command: string, cwd: string): Promise<string> {
    try {
      return execSync(command, { cwd, encoding: 'utf-8' });
    } catch (error) {
      throw new Error(`Git command failed: ${command}. Error: ${(error as Error).message}`);
    }
  }

  private ensureRemote(cwd: string, remoteName: string, remoteUrl: string): void {
    try {
      execSync(`git remote add ${remoteName} ${remoteUrl}`, { cwd, stdio: 'ignore' });
    } catch {
      execSync(`git remote set-url ${remoteName} ${remoteUrl}`, { cwd, stdio: 'ignore' });
    }
  }

  async verify(options: SyncOptions): Promise<SyncVerification> {
    const { hubUrl, method, prefix } = options;
    const cwd = process.cwd();
    const remoteName = 'hub-verify';

    try {
      this.ensureRemote(cwd, remoteName, hubUrl);

      const fetchResult = await this.execGit(`git fetch ${remoteName} main --depth=1 2>&1`, cwd);

      if (fetchResult.includes('fatal') || fetchResult.includes('error')) {
        return {
          ok: false,
          reachable: false,
          canSyncWithoutConflict: false,
          message: `Failed to fetch from hub: ${fetchResult}`,
        };
      }

      const localFiles = new Set<string>();
      if (method === 'subtree' && prefix) {
        try {
          const subtreeFiles = await this.execGit(`git ls-files ${prefix}`, cwd);
          subtreeFiles
            .split('\n')
            .filter(Boolean)
            .forEach((f: string) => localFiles.add(f));
        } catch {
          return {
            ok: false,
            reachable: true,
            canSyncWithoutConflict: false,
            message: 'Could not list subtree files',
          };
        }
      } else {
        try {
          const allFiles = await this.execGit('git ls-files', cwd);
          allFiles
            .split('\n')
            .filter(Boolean)
            .forEach((f: string) => localFiles.add(f));
        } catch {
          return {
            ok: false,
            reachable: true,
            canSyncWithoutConflict: false,
            message: 'Could not list files',
          };
        }
      }

      const hasLocalChanges = localFiles.size > 0;

      return {
        ok: true,
        reachable: true,
        canSyncWithoutConflict: !hasLocalChanges,
        message: hasLocalChanges
          ? `Local changes detected in ${localFiles.size} files. Sync may cause conflicts.`
          : 'Sync can proceed without conflicts',
      };
    } catch (error) {
      return {
        ok: false,
        reachable: false,
        canSyncWithoutConflict: false,
        message: `Verification failed: ${(error as Error).message}`,
      };
    }
  }

  async pull(options: SyncOptions): Promise<SyncResult> {
    const { hubUrl, method, prefix, commitMessage, dryRun } = options;
    const cwd = process.cwd();
    const remoteName = 'hub-origin';
    const defaultMessage =
      method === 'subtree'
        ? `chore: sync with serverlessclaw hub via subtree (${prefix})`
        : 'chore: sync with serverlessclaw hub via fork merge';

    logger.info(`Starting pull sync with hub: ${hubUrl}`);

    try {
      this.ensureRemote(cwd, remoteName, hubUrl);

      await this.execGit(`git fetch ${remoteName} main`, cwd);

      if (dryRun) {
        return {
          success: true,
          message: 'Dry run: pull would be executed',
        };
      }

      if (method === 'subtree') {
        await this.execGit(
          `git subtree pull --prefix=${prefix} ${remoteName} main --squash -m "${commitMessage || defaultMessage}"`,
          cwd
        );
      } else {
        await this.execGit(
          `git merge ${remoteName}/main -m "${commitMessage || defaultMessage}"`,
          cwd
        );
      }

      const commitHash = await this.execGit('git rev-parse HEAD', cwd);

      return {
        success: true,
        message: 'Pull sync completed successfully',
        commitHash: commitHash.trim(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Pull sync failed: ${(error as Error).message}`,
      };
    }
  }

  async push(options: SyncOptions): Promise<SyncResult> {
    const { hubUrl, method, prefix, commitMessage } = options;
    const cwd = process.cwd();
    const remoteName = 'hub-origin';
    const defaultMessage =
      method === 'subtree'
        ? `feat: contribute to serverlessclaw hub via subtree (${prefix})`
        : 'feat: contribute to serverlessclaw hub via fork';

    logger.info(`Starting push sync to hub: ${hubUrl}`);

    try {
      this.ensureRemote(cwd, remoteName, hubUrl);

      if (method === 'subtree') {
        await this.execGit(
          `git subtree push --prefix=${prefix} ${remoteName} main -m "${commitMessage || defaultMessage}"`,
          cwd
        );
      } else {
        await this.execGit(
          `git push ${remoteName} HEAD:main -m "${commitMessage || defaultMessage}"`,
          cwd
        );
      }

      const commitHash = await this.execGit('git rev-parse HEAD', cwd);

      return {
        success: true,
        message: 'Push sync completed successfully',
        commitHash: commitHash.trim(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Push sync failed: ${(error as Error).message}`,
      };
    }
  }
}

export const syncOrchestrator = new DefaultSyncOrchestrator();
