# Plugin System — Authoring & Integration Guide

How to build and register a plugin that extends Serverless Claw with custom agents, tools, MCP servers, or webhooks.

## Overview

Serverless Claw uses an **environment-driven plugin system** that loads optional domain-specific capabilities without touching framework code. Any project can ship its own plugin package and register it at runtime:

- Framework stays generic and reusable
- Multiple plugins coexist without conflicts
- Single environment variable for registration (`CLAW_OPTIONAL_PLUGIN_MODULES`)
- Full backward compatibility — framework runs normally with no plugins set

## 1. Create Your Plugin Package

Scaffold a new package anywhere in your workspace:

```
packages/integration-my-product/
├── package.json
├── tsconfig.json
├── plugin.ts          ← dynamic-import entry point
└── src/
    └── index.ts       ← ClawPlugin implementation
```

### `package.json`

```json
{
  "name": "@my-org/integration-my-product",
  "version": "1.0.0",
  "type": "module",
  "main": "./plugin.ts",
  "exports": {
    ".": "./plugin.ts",
    "./plugin": "./plugin.ts"
  },
  "dependencies": {
    "@serverlessclaw/sdk": "workspace:*"
  }
}
```

### `src/index.ts`

```typescript
import { ToolType } from '@serverlessclaw/core/lib/types/index';
import type { ClawPlugin } from '@serverlessclaw/sdk';

export const myPlugin: ClawPlugin = {
  id: 'my-product',

  agents: {
    'my-agent': {
      id: 'my-agent',
      name: 'My Agent',
      description: 'Does something useful for my product.',
      provider: 'bedrock',
      model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      tools: ['my_tool'],
    },
  },

  tools: {
    my_tool: {
      name: 'my_tool',
      description: 'Performs an action for my product.',
      type: ToolType.FUNCTION,
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'The target resource.' },
        },
        required: ['target'],
        additionalProperties: false,
      },
      connectionProfile: ['my-product'],  // resource connections for topology
      requiresApproval: true,             // set false only for read-only tools
      sensitive: true,                    // flags tool for mandatory approval/RBAC
      requiredPermissions: ['my-product:write'],
      execute: async (args) => { /* implementation */ },
    },
  },

  onInit: async () => {
    console.log('[MyPlugin] Initialized.');
  },
};

export default myPlugin;
```

### `plugin.ts`

Re-export for the framework's dynamic importer:

```typescript
export { myPlugin as default, myPlugin } from './src/index.js';
```

## 2. Register Your Plugin

Set `CLAW_OPTIONAL_PLUGIN_MODULES` before starting the framework:

```bash
# Single plugin
export CLAW_OPTIONAL_PLUGIN_MODULES="@my-org/integration-my-product"

# Multiple plugins (comma-separated, no spaces)
export CLAW_OPTIONAL_PLUGIN_MODULES="@my-org/integration-a,@my-org/integration-b"

# No plugins (framework default)
unset CLAW_OPTIONAL_PLUGIN_MODULES
```

The framework's `initializePlugins()` loop picks this up automatically — no code changes needed.

## 3. Verify It Loads

```bash
export CLAW_OPTIONAL_PLUGIN_MODULES="@my-org/integration-my-product"
pnpm dev

# Logs should show:
# [PluginManager] Registered plugin: my-product
# [MyPlugin] Initialized.
```

Check the agent is discoverable:

```bash
curl -s http://localhost:3000/api/agents | jq '.[] | select(.id == "my-agent")'
```

## 4. Test Your Plugin

Add a test alongside the package:

```typescript
// packages/integration-my-product/my-plugin.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import type { ClawPlugin } from '@serverlessclaw/sdk';

let plugin: ClawPlugin | undefined;

beforeAll(async () => {
  const m = await import('@my-org/integration-my-product').catch(() => undefined);
  plugin = m?.myPlugin ?? m?.default;
});

describe('my-product plugin', () => {
  it('has correct id', () => {
    if (!plugin) return;
    expect(plugin.id).toBe('my-product');
  });

  it('declares all tools referenced by agents', () => {
    if (!plugin) return;
    for (const agent of Object.values(plugin.agents)) {
      for (const toolId of agent.tools ?? []) {
        expect(plugin.tools, `missing tool: ${toolId}`).toHaveProperty(toolId);
      }
    }
  });

  it('enforces approval on write tools', () => {
    if (!plugin) return;
    // Adapt this check to your domain's safety requirements
    expect(plugin.tools.my_tool.requiresApproval).toBe(true);
  });
});
```

Run with:

```bash
CLAW_OPTIONAL_PLUGIN_MODULES="@my-org/integration-my-product" pnpm test
```

## 5. Plugin Interface Reference

Full `ClawPlugin` type is exported from `@serverlessclaw/sdk`:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique plugin identifier |
| `agents` | `Record<string, IAgentConfig>` | Agent configs keyed by agent id |
| `tools` | `Record<string, ITool>` | Tool implementations keyed by tool name |
| `mcpServers` | `Record<string, MCPServerConfig>` | Optional MCP server configs |
| `prompts` | `Record<string, string>` | Optional system prompt overrides |
| `memoryProviders` | `Record<string, IMemory>` | Optional custom memory backends |
| `llmProviders` | `Record<string, IProvider>` | Optional custom LLM providers |
| `webhooks` | `Record<string, WebhookConfig>` | Optional inbound webhook handlers |
| `approvalPolicies` | `Record<string, ApprovalPolicy>` | Optional custom approval policies |
| `sidebarExtensions` | `unknown[]` | Optional dashboard sidebar extensions |
| `layoutExtensions` | `unknown[]` | Optional dashboard layout extensions |
| `onInit` | `() => Promise<void>` | Called once on framework startup |

## 6. Production Deployment

Set the environment variable in your deployment target:

**AWS Lambda (SST)**
```bash
# .env.prod
CLAW_OPTIONAL_PLUGIN_MODULES=@my-org/integration-my-product
```

**Docker**
```dockerfile
ENV CLAW_OPTIONAL_PLUGIN_MODULES="@my-org/integration-my-product"
```

**GitHub Actions**
```yaml
env:
  CLAW_OPTIONAL_PLUGIN_MODULES: "@my-org/integration-my-product"
```

## 7. Conventions

- One plugin package per domain
- Plugin id must be lowercase, hyphenated: `my-product`
- All write/mutating tools must have `requiresApproval: true`
- Never import plugins directly in framework code — always go through the env var
- Keep `plugin.ts` as a thin re-export; put all logic in `src/`

## See Also

- [`packages/core/lib/plugins.ts`](../../packages/core/lib/plugins.ts) — plugin bootstrap implementation
- [`packages/core/lib/plugin-manager.ts`](../../packages/core/lib/plugin-manager.ts) — `PluginManager` API
- [`packages/sdk`](../../packages/sdk) — `ClawPlugin` and related types
- [`packages/integration-github`](../../packages/integration-github) — reference implementation
