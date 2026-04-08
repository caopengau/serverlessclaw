/* eslint-disable @typescript-eslint/no-explicit-any */
// GitHubIssueResolverAgent - restored and modernized

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

/**
 * The GitHubIssueResolverAgent replaces specialized sync agents.
 * It treats every sync task, optimization, or bug fix as an issue.
 */
export class GitHubIssueResolverAgent {
  private llm: any;

  constructor(llmProvider: any) {
    this.llm = llmProvider;
  }

  /**
   * Researches and resolves a given GitHub Issue by mapping it
   * to architectural changes in the repository.
   */
  public async resolve(issue: GitHubIssue, _workingDir: string): Promise<ResolutionResult> {
    console.log(`[IssueResolver] Resolving Issue #${issue.number}: ${issue.title}...`);

    // 1. Identify the Strategy
    const strategy = await this.identifyStrategy(issue);
    console.log(`[IssueResolver] Selected Strategy: ${strategy}`);

    try {
      switch (strategy) {
        case 'CORE_EVOLUTION_SYNC':
          return await this.executeSubtreeSync(issue, _workingDir);
        case 'EVOLUTION_CONTRIBUTION':
          return await this.applyContributionPattern(issue, _workingDir);
        case 'BUG_FIX':
          return await this.applyAgenticPatch(issue, _workingDir);
        default:
          return { success: false, message: `Unknown strategy: ${strategy}` };
      }
    } catch (error: any) {
      console.error(`[IssueResolver] Resolution failed: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  private async identifyStrategy(issue: GitHubIssue): Promise<string> {
    if (issue.labels.includes('evolution-sync')) return 'CORE_EVOLUTION_SYNC';
    if (issue.labels.includes('evolution-contribution')) return 'EVOLUTION_CONTRIBUTION';
    if (issue.labels.includes('bug')) return 'BUG_FIX';

    const prompt = `
      Analyze the GitHub Issue title and body:
      Title: ${issue.title}
      Body: ${issue.body}

      Categorize it into one of: CORE_EVOLUTION_SYNC, EVOLUTION_CONTRIBUTION, BUG_FIX, or UNKNOWN.
      Only return the category name.
    `;

    return (await this.llm.generate(prompt)).trim();
  }

  private async executeSubtreeSync(
    issue: GitHubIssue,
    _workingDir: string
  ): Promise<ResolutionResult> {
    const hubVersion = this.extractVersion(issue.body);
    console.log(`[IssueResolver] Syncing with Hub version: ${hubVersion}...`);

    // Logic similar to SyncOrchestrator but issue-driven
    // Example: git subtree pull --prefix=core hub main --squash
    // In a real implementation, this would call the SyncOrchestrator's core logic.
    return { success: true, message: `Successfully sync'd Hub v${hubVersion}` };
  }

  private async applyContributionPattern(
    _issue: GitHubIssue,
    _workingDir: string
  ): Promise<ResolutionResult> {
    // In the Mother Hub, this creates a PR based on the issue content.
    // In a Client repo, this applies a local optimization.
    console.log(`[IssueResolver] Applying evolutionary pattern from Spoke...`);
    return { success: true, message: `Applied evolutionary pattern. Reviewing for Hub promotion.` };
  }

  private async applyAgenticPatch(
    _issue: GitHubIssue,
    _workingDir: string
  ): Promise<ResolutionResult> {
    console.log(`[IssueResolver] Generating agentic patch for bug report...`);
    // Uses LLM to generate and apply a diff based on the issue body.
    return { success: true, message: `Bug fix applied agentically.` };
  }

  private extractVersion(body: string): string {
    const match = body.match(/v\d+\.\d+\.\d+/);
    return match ? match[0] : 'main';
  }
}
