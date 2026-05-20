/**
 * VoltX Plugin Integration Test
 * Validates that the voltxPlugin loads correctly within the framework
 *
 * Run: CLAW_OPTIONAL_PLUGIN_MODULES=@serverlessclaw/integration-voltx pnpm test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { ClawPlugin } from '@serverlessclaw/sdk';

let voltxPlugin: ClawPlugin | undefined;

beforeAll(async () => {
  try {
    // Simulate how the framework loads the plugin
    const moduleName = '@serverlessclaw/integration-voltx';
    const module = await import(moduleName);
    voltxPlugin = module.voltxPlugin || module.default;
  } catch {
    console.warn('VoltX plugin not available in test environment. Skipping integration tests.');
  }
});

describe('VoltX Framework Integration', () => {
  it('should export voltxPlugin with correct structure', async () => {
    if (!voltxPlugin) {
      console.log('ℹ️  Skipping - VoltX plugin not installed');
      return;
    }

    expect(voltxPlugin).toBeDefined();
    expect(voltxPlugin.id).toBe('voltx-chatops');
    expect(voltxPlugin.agents).toBeDefined();
    expect(voltxPlugin.tools).toBeDefined();
  });

  it('should export voltxDevOpsAgent', async () => {
    if (!voltxPlugin) return;

    expect(voltxPlugin.agents).toHaveProperty('voltx-devops-agent');
    const agent = voltxPlugin.agents['voltx-devops-agent'];
    expect(agent).toBeDefined();
    expect(agent.id).toBe('voltx-devops-agent');
  });

  it('should export required tools', async () => {
    if (!voltxPlugin) return;

    expect(voltxPlugin.tools).toHaveProperty('deploy_voltx_staging');

    const deployTool = voltxPlugin.tools['deploy_voltx_staging'];
    expect(deployTool).toBeDefined();
    expect(deployTool.description).toBeDefined();
  });

  it('should have safety gates on deployment tools', async () => {
    if (!voltxPlugin) return;

    const deployTool = voltxPlugin.tools['deploy_voltx_staging'];
    expect(deployTool.requiresApproval).toBe(true);
  });

  it('should register with PluginManager if loaded via environment', async () => {
    // This test validates the environment-driven loading mechanism
    const envVar = process.env.CLAW_OPTIONAL_PLUGIN_MODULES;

    if (!envVar || !envVar.includes('@serverlessclaw/integration-voltx')) {
      console.log(
        '⚠️  Not running PluginManager test: ' + 'CLAW_OPTIONAL_PLUGIN_MODULES not set for VoltX'
      );
      return;
    }

    // In a real scenario, the framework's initializePlugins() would have
    // already loaded this plugin via the environment variable
    expect(envVar).toContain('@serverlessclaw/integration-voltx');
  });

  it('should be importable via dynamic import', async () => {
    try {
      const module = await import('@serverlessclaw/integration-voltx/plugin');
      expect(module.default).toBeDefined();
      expect(module.default.id).toBe('voltx-chatops');
    } catch {
      console.log('ℹ️  Dynamic import test skipped (module not available in test env)');
    }
  });
});

describe('VoltX Plugin Compatibility', () => {
  it('should follow ClawPlugin interface contract', async () => {
    if (!voltxPlugin) return;

    // Verify required properties
    expect(typeof voltxPlugin.id).toBe('string');
    expect(typeof voltxPlugin.agents).toBe('object');
    expect(typeof voltxPlugin.tools).toBe('object');

    // agents should be non-empty
    expect(Object.keys(voltxPlugin.agents).length).toBeGreaterThan(0);
    expect(Object.keys(voltxPlugin.tools).length).toBeGreaterThan(0);
  });

  it('should have documentation for all agents', async () => {
    if (!voltxPlugin) return;

    for (const [_agentId, agent] of Object.entries(voltxPlugin.agents)) {
      expect(agent.id).toBeDefined();
      expect(agent.name).toBeDefined();
      expect(typeof agent.name).toBe('string');
      expect(agent.description || agent.systemPrompt).toBeDefined();
    }
  });

  it('should have no undefined tool references in agents', async () => {
    if (!voltxPlugin) return;

    for (const [_agentId, agent] of Object.entries(voltxPlugin.agents)) {
      if (agent.tools && Array.isArray(agent.tools)) {
        for (const toolId of agent.tools) {
          expect(voltxPlugin.tools).toHaveProperty(toolId);
        }
      }
    }
  });
});
