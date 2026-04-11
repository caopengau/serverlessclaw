import { ConfigManager } from '../../../lib/registry/config';
import { DYNAMO_KEYS } from '../../../lib/constants';
import { logger } from '../../../lib/logger';
import { BACKBONE_REGISTRY } from '../../../lib/backbone';
import * as fs from 'fs';
import * as path from 'path';

export interface PruneProposal {
  swarm: {
    unusedTools: string[];
    zombieAgents: string[];
    perAgentBloat: Array<{ agentId: string; unusedTools: string[] }>;
  };
  codebase: {
    emptyDirs: string[];
    debtMarkers: number;
    orphanedFiles: string[];
  };
  thresholdDays: number;
  lastAudit: number;
}

/**
 * ScytheLogic handles the identification and telemetry of bloat and debt.
 * It is the core engine for Silo 7 (The Scythe) of the Cognition Reflector.
 */
export class ScytheLogic {
  private static readonly CONFIG_KEYS = {
    AUTO_PRUNE: 'auto_prune_enabled',
    PRUNE_THRESHOLD: 'tool_prune_threshold_days',
    IMMUNE_TOOLS: 'immune_tools',
    TOOL_HISTORY: 'scythe:tool_count_history',
    PENDING_PROPOSAL: 'pending_prune_proposal',
  } as const;

  private static get BACKBONE_IDS(): string[] {
    return Object.keys(BACKBONE_REGISTRY);
  }
  private static readonly IMMUNE_TOOLS = [
    'dispatchTask',
    'listAgents',
    'saveMemory',
    'recallKnowledge',
    'sendMessage',
    'checkHealth',
    'triggerRollback',
    'forceReleaseLock',
    'runShellCommand',
    'validateCode',
  ];

  /**
   * Retrieves the combined list of immune tools (hardcoded + config).
   */
  private static async getImmuneTools(): Promise<string[]> {
    const configuredImmunity = await ConfigManager.getTypedConfig<string[]>(
      ScytheLogic.CONFIG_KEYS.IMMUNE_TOOLS,
      []
    );
    return Array.from(new Set([...ScytheLogic.IMMUNE_TOOLS, ...configuredImmunity]));
  }

  /**
   * Generates a "Prune Proposal" explicitly categorized by debt level:
   * 1. Agentic Swarm Level (Tools, Agents, Registry)
   * 2. Codebase Level (Files, Markers, Debris)
   */
  public static async generatePruneProposal(): Promise<PruneProposal | undefined> {
    const isEnabled = await ConfigManager.getTypedConfig(ScytheLogic.CONFIG_KEYS.AUTO_PRUNE, false);
    if (!isEnabled) {
      logger.info('[SCYTHE] Auto-pruning is disabled. Skipping proposal generation.');
      return undefined;
    }

    const thresholdDays = await ConfigManager.getTypedConfig(
      ScytheLogic.CONFIG_KEYS.PRUNE_THRESHOLD,
      30
    );
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
    const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // 1. Swarm Level: Unused Tools
    const { TOOLS } = await import('../../../tools/index');
    const toolUsage = (await ConfigManager.getRawConfig(DYNAMO_KEYS.TOOL_USAGE)) as
      | Record<string, { count: number; lastUsed: number; firstRegistered?: number }>
      | undefined;

    const unusedTools: string[] = [];
    if (toolUsage) {
      const registeredToolNames = Object.keys(TOOLS);
      const immuneTools = await this.getImmuneTools();
      const missingStats: string[] = [];

      for (const name of registeredToolNames) {
        if (immuneTools.includes(name)) continue;
        const stats = toolUsage[name];
        if (!stats) {
          missingStats.push(name);
          continue;
        }
        const firstRegistered = stats.firstRegistered || stats.lastUsed;
        if (now - firstRegistered < GRACE_PERIOD_MS) continue;
        const effectiveLastUsed = stats.lastUsed || stats.firstRegistered || 0;
        if (effectiveLastUsed === 0 || now - effectiveLastUsed > thresholdMs) {
          unusedTools.push(name);
        }
      }
      if (missingStats.length > 0) {
        const { AgentRegistry } = await import('../../../lib/registry/AgentRegistry');
        await AgentRegistry.initializeToolStats(missingStats);
      }
    }

    // 2. Swarm Level: Per-Agent Bloat & Zombie Agents
    const perAgentBloat: Array<{ agentId: string; unusedTools: string[] }> = [];
    const zombieAgents: string[] = [];
    try {
      const { AgentRegistry } = await import('../../../lib/registry/AgentRegistry');
      const allAgents = await AgentRegistry.getAllConfigs();
      const immuneTools = await this.getImmuneTools();

      for (const [agentId, config] of Object.entries(allAgents)) {
        const usageKey = `tool_usage_${agentId}`;
        const agentToolUsage = (await ConfigManager.getRawConfig(usageKey)) as
          | Record<string, { count: number; lastUsed: number }>
          | undefined;

        if (agentToolUsage && Object.keys(agentToolUsage).length > 0) {
          // Check for Per-Agent Bloat
          if (config.tools) {
            const unusedByAgent = config.tools.filter((t) => {
              if (immuneTools.includes(t)) return false;
              const stats = agentToolUsage[t];
              return !stats || now - stats.lastUsed > thresholdMs;
            });
            if (unusedByAgent.length > 5) {
              perAgentBloat.push({ agentId, unusedTools: unusedByAgent });
            }
          }
        } else {
          // Zombie Agent? (No usage history recorded at all, and is a dynamic agent)
          const isBackbone = ScytheLogic.BACKBONE_IDS.includes(agentId);
          if (!isBackbone) {
            zombieAgents.push(agentId);
          }
        }
      }
    } catch (e) {
      logger.warn('[SCYTHE] Swarm debt analysis failed:', e);
    }

    // 3. Codebase Level: Markets & Markers
    let debtMarkers = 0;
    const emptyDirs: string[] = [];
    const orphanedFiles: string[] = [];

    try {
      const coreDir = path.resolve(process.cwd(), 'core');
      if (fs.existsSync(coreDir)) {
        const allFiles: string[] = [];

        // Simple search for TODO/FIXME and collect files
        const scan = (dir: string) => {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
              if (file === 'node_modules' || file === '.git' || file === '.gemini') continue;
              const subFiles = fs.readdirSync(fullPath);
              if (subFiles.length === 0) emptyDirs.push(path.relative(process.cwd(), fullPath));
              else scan(fullPath);
            } else if (file.endsWith('.ts') || file.endsWith('.js')) {
              allFiles.push(fullPath);
              const content = fs.readFileSync(fullPath, 'utf8');
              const matches = content.match(/\/\/\s*(TODO|FIXME)/gi);
              if (matches) debtMarkers += matches.length;
            }
          }
        };
        scan(coreDir);

        // Heuristic: Orphaned Files
        // If a file is not imported by any other file (excluding its own directory siblings for simplicity?)
        // Actually, check if the filename without ext is mentioned in any other file.
        for (const file of allFiles) {
          const base = path.basename(file, path.extname(file));
          if (base === 'index') continue; // Index files are usually entry points

          let referenced = false;
          for (const other of allFiles) {
            if (file === other) continue;
            const content = fs.readFileSync(other, 'utf8');
            if (content.includes(base)) {
              referenced = true;
              break;
            }
          }
          if (!referenced) {
            orphanedFiles.push(path.relative(process.cwd(), file));
          }
        }
      }
    } catch (e) {
      logger.warn('[SCYTHE] Codebase debt analysis failed:', e);
    }

    if (
      unusedTools.length === 0 &&
      perAgentBloat.length === 0 &&
      zombieAgents.length === 0 &&
      debtMarkers === 0 &&
      emptyDirs.length === 0
    ) {
      return undefined;
    }

    return {
      swarm: { unusedTools, zombieAgents, perAgentBloat },
      codebase: { emptyDirs, debtMarkers, orphanedFiles },
      thresholdDays,
      lastAudit: now,
    };
  }

  /**
   * Records a prune proposal in the system knowledge.
   */
  public static async recordPruneProposal(
    proposal: PruneProposal,
    memory?: { addMemory: (...args: any[]) => Promise<any> }
  ): Promise<void> {
    const gapId = `prune_proposal_${Date.now()}`;

    await ConfigManager.saveRawConfig(ScytheLogic.CONFIG_KEYS.PENDING_PROPOSAL, {
      ...proposal,
      status: 'PENDING_REVIEW',
      id: gapId,
    });

    if (memory && typeof memory.addMemory === 'function') {
      try {
        const { InsightCategory } = await import('../../../lib/types/memory');
        const swarmDebtCount =
          proposal.swarm.unusedTools.length + proposal.swarm.zombieAgents.length;
        const codeDebtCount =
          proposal.codebase.emptyDirs.length + (proposal.codebase.debtMarkers > 20 ? 1 : 0);

        await memory.addMemory(
          'system',
          InsightCategory.SYSTEM_IMPROVEMENT,
          `Scythe Debt Proposal: Identified ${swarmDebtCount} swarm-level issues and ${codeDebtCount} codebase-level issues.`,
          {
            impact: 4,
            urgency: 2,
            priority: 3,
            tags: ['scythe', 'debt-reduction', 'swarm-debt', 'code-debt'],
          }
        );
      } catch (e) {
        logger.error('[SCYTHE] Failed to record prune proposal in memory:', e);
      }
    }
  }

  /**
   * Updates the tool count history to enable trend analysis in audits.
   */
  public static async updateToolHistory(memory?: {
    get?(key: string): Promise<any>;
    set?(key: string, value: any): Promise<void>;
  }): Promise<void> {
    const TOOL_HISTORY_KEY = ScytheLogic.CONFIG_KEYS.TOOL_HISTORY;
    const MAX_HISTORY = 50;

    try {
      const { TOOLS } = await import('../../../tools/index');
      const toolNames = Object.keys(TOOLS);
      const currentCount = toolNames.length;

      let history: Array<{ count: number; timestamp: number }> = [];

      if (memory && typeof memory.get === 'function') {
        history = (await memory.get(TOOL_HISTORY_KEY)) || [];
      } else {
        history = await ConfigManager.getTypedConfig<Array<{ count: number; timestamp: number }>>(
          TOOL_HISTORY_KEY,
          []
        );
      }

      if (!Array.isArray(history)) history = [];
      history.push({ count: currentCount, timestamp: Date.now() });

      const trimmedHistory = history.slice(-MAX_HISTORY);

      if (memory && typeof memory.set === 'function') {
        await memory.set(TOOL_HISTORY_KEY, trimmedHistory);
      }
      await ConfigManager.saveRawConfig(TOOL_HISTORY_KEY, trimmedHistory);
    } catch (e) {
      logger.error('[SCYTHE] Failed to update tool history:', e);
    }
  }

  /**
   * Analyzes tool growth trends.
   */
  public static async analyzeToolGrowth(memory?: { get?(key: string): Promise<any> }): Promise<{
    growthRate: number;
    oldest: { count: number; timestamp: number };
    newest: { count: number; timestamp: number };
  } | null> {
    const TOOL_HISTORY_KEY = ScytheLogic.CONFIG_KEYS.TOOL_HISTORY;
    let history;

    if (memory && typeof memory.get === 'function') {
      history = (await memory.get(TOOL_HISTORY_KEY)) || [];
    } else {
      history = await ConfigManager.getTypedConfig<Array<{ count: number; timestamp: number }>>(
        TOOL_HISTORY_KEY,
        []
      );
    }

    if (history && history.length >= 2) {
      const oldest = history[0];
      const newest = history[history.length - 1];
      const growthRate = (newest.count - oldest.count) / oldest.count;
      return { growthRate, oldest, newest };
    }
    return null;
  }

  /**
   * Detects semantic overlap between tools.
   */
  public static async detectSemanticOverlap(): Promise<string[]> {
    const { TOOLS } = await import('../../../tools/index');
    const toolNames = Object.keys(TOOLS);
    const overlaps: string[] = [];
    const SIMILARITY_THRESHOLD = 0.8;

    const getSimilarity = (s1: string, s2: string): number => {
      const longer = s1.length > s2.length ? s1 : s2;
      const shorter = s1.length > s2.length ? s2 : s1;
      if (longer.length === 0) return 1.0;
      return (longer.length - editDistance(longer, shorter)) / longer.length;
    };

    const editDistance = (s1: string, s2: string): number => {
      const costs = [];
      for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
          if (i === 0) costs[j] = j;
          else {
            if (j > 0) {
              let newValue = costs[j - 1];
              if (s1.charAt(i - 1) !== s2.charAt(j - 1))
                newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
              costs[j - 1] = lastValue;
              lastValue = newValue;
            }
          }
        }
        if (i > 0) costs[s2.length] = lastValue;
      }
      return costs[s2.length];
    };

    for (let i = 0; i < toolNames.length; i++) {
      for (let j = i + 1; j < toolNames.length; j++) {
        const t1 = toolNames[i];
        const t2 = toolNames[j];
        if (getSimilarity(t1, t2) > SIMILARITY_THRESHOLD) {
          overlaps.push(`${t1} <-> ${t2}`);
        }
      }
    }
    return overlaps;
  }

  /**
   * Scans for "dark" code (tools never executed).
   */
  public static async identifyDarkTools(): Promise<string[]> {
    const toolUsage = (await ConfigManager.getRawConfig(DYNAMO_KEYS.TOOL_USAGE)) as
      | Record<string, { count: number; lastUsed: number; firstRegistered?: number }>
      | undefined;

    if (toolUsage) {
      const { TOOLS } = await import('../../../tools/index');
      const toolNames = Object.keys(TOOLS);
      return toolNames.filter((name) => !toolUsage[name]);
    }
    return [];
  }

  /**
   * Scans for technical debt markers (TODO/FIXME).
   */
  public static async getDebtMarkerCount(): Promise<number> {
    let todoCount = 0;
    const projectRoot = process.cwd();
    const coreDir = path.resolve(projectRoot, 'core');

    const scanTodos = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory() && !file.includes('node_modules')) {
          scanTodos(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const matches = content.match(/\/\/\s*(TODO|FIXME)/gi);
          if (matches) todoCount += matches.length;
        }
      }
    };

    scanTodos(coreDir);
    return todoCount;
  }

  /**
   * Scans for empty directories.
   */
  public static async getEmptyDirectories(): Promise<string[]> {
    const emptyDirs: string[] = [];
    const coreDir = path.resolve(process.cwd(), 'core');

    const checkEmpty = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      if (files.length === 0) {
        emptyDirs.push(path.relative(process.cwd(), dir));
        return;
      }
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          checkEmpty(fullPath);
        }
      }
    };

    checkEmpty(coreDir);
    return emptyDirs;
  }
}
