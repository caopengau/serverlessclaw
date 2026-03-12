# Agent Tool Registry

> **Agent Context Loading**: Load this file when you need to add, modify, or understand any tool.

## 🛠️ Available Tools

| Tool | Purpose | Protected? | Writes to Cloud? |
|------|---------|:---:|:---:|
| `calculator` | Evaluates math expressions | — | — |
| `getWeather` | Returns mock weather (demo) | — | — |
| `dispatchTask` | Sends a task event to EventBridge → Specialized Agent | — | ✅ |
| `fileWrite` | Writes to a file in the codebase | ✅ Labelled | — |
| `validateCode` | Runs `tsc --noEmit` + `eslint` pre-flight | — | — |
| `triggerDeployment` | Starts a CodeBuild deploy (SST v4, circuit-breaker protected) | ✅ Labelled | ✅ |
| `checkHealth` | Hits `GET /health`. On success: decrements deploy counter | — | ✅ |
| `triggerRollback` | `git revert HEAD` + redeploy. Emergency use only | — | ✅ |
| `manageGap` | Updates the status of a Strategic Gap (QA Verification) | — | ✅ |
| `switchModel` | Updates active provider/model in DynamoDB (Hot Config) | — | ✅ |
| `runTests` | Executes project unit tests (vitest) | — | — |
| `recallKnowledge` | Retrieves distilled facts/lessons from memory (JIT context) | — | — |
| `listAgents` | Discovers available specialized agents in the system | — | — |

---

## 🏗️ Adding a New Tool

1. Open `core/tools/index.ts`.
2. Add an entry to the `tools` record following the `ITool` interface.
3. If this should be available to a backbone agent by default, add it to their `tools` array in `core/lib/backbone.ts`.
4. Run `validateCode` to check for regressions.
5. Update the table above.
6. Update `src/lib/tools.test.ts` to include the new tool name.

### Dynamic Scoping (Evolution Sector)
Agents no longer receive all tools by default. They call `getAgentTools(agentId)` which:
1. Checks the `AgentRegistry` (Backbone + DynamoDB overrides).
2. Returns a subset of tools assigned to that specific agent.
3. Users can grant/revoke tools for any agent in the **ClawCenter** dashboard under the **Evolution** sector (`/capabilities`).

### ITool Interface

```typescript
export interface ITool {
  name: string;
  description: string; // Shown to the LLM — be precise!
  parameters: {        // JSON Schema for the args
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
  execute: (args: any) => Promise<string>; // Always returns a string result
}
```

---

## 🛡️ Protected Files

The `fileWrite` tool blocks writes to these files to prevent accidental system destruction:

```
sst.config.ts
core/tools/index.ts
core/agents/superclaw.ts
core/lib/agent.ts
buildspec.yml
infra/**
```

Any attempt returns `PERMISSION_DENIED` and the Coder Agent **must** request `MANUAL_APPROVAL_REQUIRED` from the human on Telegram/Slack.

---

## 📡 Deploy Lifecycle (Tool Sequence)

```text
dispatchTask (coder) → fileWrite → validateCode → [human approves if protected]
                                                    ↓
                                          triggerDeployment (SST v4)
                                                    ↓
                                            checkHealth (Health Probe)
                                         ↓            ↓
                                     OK (–1 count)  FAILED → triggerRollback
```
