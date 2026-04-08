import { SyncOptions, SyncMethod } from '@serverlessclaw/core/lib/types/sync';
import { syncOrchestrator } from '@serverlessclaw/core/lib/sync/orchestrator';

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
}

export interface ResolutionResult {
  success: boolean;
  message: string;
  filesChanged?: string[];
}

interface IssueSyncConfig {
  hubUrl: string;
  prefix?: string;
  method?: SyncMethod;
}

export class GitHubIssueResolverAgent {
  private llm: unknown;
  private config: IssueSyncConfig;

  constructor(llmProvider: unknown, config: IssueSyncConfig) {
    this.llm = llmProvider;
    this.config = config;
  }

  async resolve(issue: GitHubIssue, workingDir: string): Promise<ResolutionResult> {
    console.log(`[IssueResolver] Resolving Issue #${issue.number}: ${issue.title}...`);

    const strategy = this.identifyStrategy(issue);
    console.log(`[IssueResolver] Selected Strategy: ${strategy}`);

    try {
      switch (strategy) {
        case 'CORE_EVOLUTION_SYNC':
          return await this.executeSubtreeSync(issue, workingDir);
        case 'EVOLUTION_CONTRIBUTION':
          return await this.applyContributionPattern(issue, workingDir);
        case 'BUG_FIX':
          return await this.applyAgenticPatch(issue, workingDir);
        default:
          return { success: false, message: `Unknown strategy: ${strategy}` };
      }
    } catch (error) {
      console.error(`[IssueResolver] Resolution failed: ${(error as Error).message}`);
      return { success: false, message: (error as Error).message };
    }
  }

  async verifySync(_workingDir: string): Promise<{ ok: boolean; message: string }> {
    const options: SyncOptions = {
      hubUrl: this.config.hubUrl,
      prefix: this.config.prefix,
      method: this.config.method || 'subtree',
      commitMessage: 'verify-sync',
    };

    const result = await syncOrchestrator.verify(options);
    return {
      ok: result.ok,
      message: result.message || 'Verification complete',
    };
  }

  private identifyStrategy(issue: GitHubIssue): string {
    if (issue.labels.includes('evolution-sync')) return 'CORE_EVOLUTION_SYNC';
    if (issue.labels.includes('evolution-contribution')) return 'EVOLUTION_CONTRIBUTION';
    if (issue.labels.includes('bug')) return 'BUG_FIX';
    return 'UNKNOWN';
  }

  private async executeSubtreeSync(
    issue: GitHubIssue,
    _workingDir: string
  ): Promise<ResolutionResult> {
    const hubVersion = this.extractVersion(issue.body);
    console.log(`[IssueResolver] Syncing with Hub version: ${hubVersion}...`);

    const options: SyncOptions = {
      hubUrl: this.config.hubUrl,
      prefix: this.config.prefix || 'core/',
      method: this.config.method || 'subtree',
      commitMessage: `chore: sync with hub via issue #${issue.number} (${hubVersion})`,
      gapIds: [`issue-${issue.number}`],
    };

    const verifyResult = await syncOrchestrator.verify(options);
    if (!verifyResult.canSyncWithoutConflict) {
      return {
        success: false,
        message: `Cannot sync: conflicts detected - ${verifyResult.message}`,
      };
    }

    const pullResult = await syncOrchestrator.pull(options);

    if (pullResult.success) {
      return {
        success: true,
        message: `Successfully synced to Hub v${hubVersion}. Commit: ${pullResult.commitHash}`,
        filesChanged: pullResult.conflicts?.map((c) => c.file),
      };
    }

    return {
      success: false,
      message: `Sync failed: ${pullResult.message}`,
    };
  }

  private async applyContributionPattern(
    issue: GitHubIssue,
    _workingDir: string
  ): Promise<ResolutionResult> {
    console.log(`[IssueResolver] Applying evolutionary pattern from Spoke...`);

    const options: SyncOptions = {
      hubUrl: this.config.hubUrl,
      prefix: this.config.prefix || 'core/',
      method: this.config.method || 'subtree',
      commitMessage: `feat: contribute from issue #${issue.number}`,
      gapIds: [`contrib-${issue.number}`],
    };

    const pushResult = await syncOrchestrator.push(options);

    if (pushResult.success) {
      return {
        success: true,
        message: `Contribution pushed. Commit: ${pushResult.commitHash}. Creating hub issue for tracking.`,
        filesChanged: [],
      };
    }

    return {
      success: false,
      message: `Contribution push requires hub review: ${pushResult.message}`,
    };
  }

  private async applyAgenticPatch(
    issue: GitHubIssue,
    _workingDir: string
  ): Promise<ResolutionResult> {
    console.log(`[IssueResolver] Generating agentic patch for bug report...`);

    if (!this.llm) {
      return {
        success: false,
        message: 'No LLM provider configured for agentic patch generation',
      };
    }

    const prompt = `
      Analyze this bug report and generate a patch:
      
      Issue #${issue.number}: ${issue.title}
      Description: ${issue.body}
      
      Generate a diff/patch to fix this bug. Return the patch in unified diff format.
    `;

    const response = await (
      this.llm as { generate: (prompt: string) => Promise<{ text: () => Promise<string> }> }
    ).generate(prompt);
    const patchText = await response.text();

    console.log(`[IssueResolver] Generated patch (${patchText.length} chars)`);

    return {
      success: true,
      message: `Bug fix patch generated for issue #${issue.number}. Manual review required.`,
    };
  }

  private extractVersion(body: string): string {
    const match = body.match(/v\d+\.\d+\.\d+/);
    return match ? match[0] : 'main';
  }
}
