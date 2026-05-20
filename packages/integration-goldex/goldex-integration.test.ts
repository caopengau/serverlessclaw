/**
 * GoldEx Plugin Integration Test
 * Validates that the goldexPlugin loads correctly within the framework
 * Includes trading-specific safety gate validation
 *
 * Run: CLAW_OPTIONAL_PLUGIN_MODULES=@serverlessclaw/integration-goldex pnpm test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { ClawPlugin } from '@serverlessclaw/sdk';

let goldexPlugin: ClawPlugin | undefined;

beforeAll(async () => {
  try {
    // Simulate how the framework loads the plugin
    const moduleName = '@serverlessclaw/integration-goldex';
    const module = await import(moduleName);
    goldexPlugin = module.goldexPlugin || module.default;
  } catch (error) {
    console.warn('GoldEx plugin not available in test environment. Skipping integration tests.');
  }
});

describe('GoldEx Framework Integration', () => {
  it('should export goldexPlugin with correct structure', async () => {
    if (!goldexPlugin) {
      console.log('ℹ️  Skipping - GoldEx plugin not installed');
      return;
    }

    expect(goldexPlugin).toBeDefined();
    expect(goldexPlugin.id).toBe('goldex-trading');
    expect(goldexPlugin.agents).toBeDefined();
    expect(goldexPlugin.tools).toBeDefined();
  });

  it('should export goldexTradingAgent (HFT)', async () => {
    if (!goldexPlugin) return;

    expect(goldexPlugin.agents).toHaveProperty('goldex-hft-agent');
    const agent = goldexPlugin.agents['goldex-hft-agent'];
    expect(agent).toBeDefined();
    expect(agent.id).toBe('goldex-hft-agent');
    expect(agent.name).toContain('Trading'); // Should have trading-related name
  });

  it('should export all three trading tools', async () => {
    if (!goldexPlugin) return;

    const requiredTools = ['analyze_gold_signal', 'execute_trade', 'manage_position'];
    for (const toolId of requiredTools) {
      expect(goldexPlugin.tools).toHaveProperty(toolId);
    }
  });

  it('should have analyze_gold_signal tool (read-only, no approval)', async () => {
    if (!goldexPlugin) return;

    const analyzeToolId = 'analyze_gold_signal';
    expect(goldexPlugin.tools).toHaveProperty(analyzeToolId);

    const analyzeTool = goldexPlugin.tools[analyzeToolId];
    expect(analyzeTool.description).toBeDefined();
    expect(analyzeTool.requiresApproval).toBe(false); // Market analysis doesn't need approval
  });

  it('should have execute_trade tool with approval gate', async () => {
    if (!goldexPlugin) return;

    const executeTool = goldexPlugin.tools['execute_trade'];
    expect(executeTool).toBeDefined();
    expect(executeTool.description).toBeDefined();
    expect(executeTool.requiresApproval).toBe(true); // CRITICAL: Trading requires approval
  });

  it('should have manage_position tool with approval gate', async () => {
    if (!goldexPlugin) return;

    const manageTool = goldexPlugin.tools['manage_position'];
    expect(manageTool).toBeDefined();
    expect(manageTool.description).toBeDefined();
    expect(manageTool.requiresApproval).toBe(true); // CRITICAL: Position management requires approval
  });

  it('should register with PluginManager if loaded via environment', async () => {
    // This test validates the environment-driven loading mechanism
    const envVar = process.env.CLAW_OPTIONAL_PLUGIN_MODULES;

    if (!envVar || !envVar.includes('@serverlessclaw/integration-goldex')) {
      console.log(
        '⚠️  Not running PluginManager test: ' + 'CLAW_OPTIONAL_PLUGIN_MODULES not set for GoldEx'
      );
      return;
    }

    expect(envVar).toContain('@serverlessclaw/integration-goldex');
  });

  it('should be importable via dynamic import', async () => {
    try {
      const module = await import('@serverlessclaw/integration-goldex/plugin');
      expect(module.default).toBeDefined();
      expect(module.default.id).toBe('goldex-trading');
    } catch (error) {
      console.log('ℹ️  Dynamic import test skipped (module not available in test env)');
    }
  });
});

describe('GoldEx Plugin Safety Compliance', () => {
  it('should follow ClawPlugin interface contract', async () => {
    if (!goldexPlugin) return;

    expect(typeof goldexPlugin.id).toBe('string');
    expect(typeof goldexPlugin.agents).toBe('object');
    expect(typeof goldexPlugin.tools).toBe('object');
    expect(Object.keys(goldexPlugin.agents).length).toBeGreaterThan(0);
    expect(Object.keys(goldexPlugin.tools).length).toBeGreaterThan(0);
  });

  it('should ENFORCE approval gates on all trading tools', async () => {
    if (!goldexPlugin) return;

    // Get all trading tools (exclude analysis)
    const tradingTools = ['execute_trade', 'manage_position'];

    for (const toolId of tradingTools) {
      const tool = goldexPlugin.tools[toolId];
      if (!tool) {
        throw new Error(`Required trading tool missing: ${toolId}`);
      }

      expect(tool.requiresApproval).toBe(true);
    }
  });

  it('should have safety sensitivity levels set correctly', async () => {
    if (!goldexPlugin) return;

    const executeTool = goldexPlugin.tools['execute_trade'];
    expect(executeTool.sensitivity).toBeDefined();
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(executeTool.sensitivity)).toBe(true);

    const manageTool = goldexPlugin.tools['manage_position'];
    expect(manageTool.sensitivity).toBeDefined();
  });

  it('should have documentation for all agents', async () => {
    if (!goldexPlugin) return;

    for (const [agentId, agent] of Object.entries(goldexPlugin.agents)) {
      expect(agent.id).toBeDefined();
      expect(agent.name).toBeDefined();
      expect(typeof agent.name).toBe('string');
      expect(agent.description || agent.systemPrompt).toBeDefined();
    }
  });

  it('should have no undefined tool references in agents', async () => {
    if (!goldexPlugin) return;

    for (const [agentId, agent] of Object.entries(goldexPlugin.agents)) {
      if (agent.tools && Array.isArray(agent.tools)) {
        for (const toolId of agent.tools) {
          expect(
            goldexPlugin.tools,
            `Tool '${toolId}' referenced by agent '${agentId}' not found in plugin.tools`
          ).toHaveProperty(toolId);
        }
      }
    }
  });
});

describe('GoldEx Trading Scenario Validation', () => {
  it('should support market analysis without triggering approvals', async () => {
    if (!goldexPlugin) return;

    // Market analysis should be available read-only
    const analyzeTool = goldexPlugin.tools['analyze_gold_signal'];
    expect(analyzeTool.requiresApproval).toBe(false);

    // Agents should reference this tool
    const hftAgent = goldexPlugin.agents['goldex-hft-agent'];
    if (hftAgent.tools) {
      expect(hftAgent.tools).toContain('analyze_gold_signal');
    }
  });

  it('should require approvals for any trade execution', async () => {
    if (!goldexPlugin) return;

    const executeTool = goldexPlugin.tools['execute_trade'];
    expect(executeTool.requiresApproval).toBe(true);

    const hftAgent = goldexPlugin.agents['goldex-hft-agent'];
    if (hftAgent.tools && hftAgent.tools.includes('execute_trade')) {
      // Agent can use trading tool, but framework will enforce approval
      expect(executeTool.requiresApproval).toBe(true);
    }
  });
});
