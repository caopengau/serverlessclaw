# Agent Architecture & Orchestration

> **Agent Context Loading**: Load this file when you need to modify agent logic, prompts, communication patterns, or add a new sub-agent.

## Agent Roster

| Agent | Runtime | System Prompt Location | Responsibilities |
|-------|---------|------------------------|-----------------|
| **Main Agent** | `src/agents/webhook.ts` + `src/lib/agent.ts` | `src/lib/agent.ts` (default param) | Interprets user intent, delegates, deploys |
| **Coder Agent** | `src/agents/coder.ts` | `src/agents/coder.ts` | Writes code, runs pre-flight checks |
| **Deployer** | AWS CodeBuild (`buildspec.yml`) | `buildspec.yml` | Runs `sst deploy` in isolated environment |
| **Build Monitor** | `src/agents/monitor.ts` | — | Watches for build failures, extracts logs |

---

## Orchestration Flow

```
User (Telegram)
      │
      ▼
POST /webhook → Main Agent (Lambda)
      │
      ├──dispatch_task("coder", task)──► EventBridge AgentBus
      │                                         │
      │                                         ▼
      │                                  Coder Agent (Lambda)
      │                                    │ file_write
      │                                    │ validate_code
      │                                    └─► (returns summary)
      │
      ├──trigger_deployment──► CodeBuild Deployer
      │                               │
      │      (ON FAILURE)             ▼
      │      └────────────────── Build Monitor ──► system.build.failed (Bus)
      │                                                   │
      │                                                   ▼
      │                                             EventHandler (Main Agent)
      │                                                   │
      │                                                   ▼
      │                                             dispatch_task("coder", fix)
      │
      └──check_health──► GET /health (src/health.ts)
```
              ├── OK  → notify user, reward counter
              └── FAIL → trigger_rollback → notify user
```

---

## Communication Protocol (EventBridge)

- **Bus name**: `AgentBus` (SST resource)
- **Event source**: `main.agent`
- **Detail type for Coder**: `coder.task`
- **Event payload**:
  ```json
  { "userId": "<string>", "task": "<natural language task description>" }
  ```

All inter-agent state is tracked in **DynamoDB** (`MemoryTable`).

---

## Main Agent System Prompt (Summary)

Key obligations (see `src/agent.ts` for the full prompt):
1. **delegate** complex changes via `dispatch_task`
2. **deploy then verify**: `trigger_deployment` → `check_health`
3. **rollback on failure**: `CIRCUIT_BREAKER_ACTIVE` or `HEALTH_FAILED` → `trigger_rollback`
4. **HITL**: Stop and ask human on Telegram for any `MANUAL_APPROVAL_REQUIRED`
5. **protect core**: 3 confirmations to delete `AgentBus` or `MemoryTable`

---

## Coder Agent System Prompt (Summary)

Key obligations (see `src/coder.ts` for the full prompt):
1. **pre-flight**: Call `validate_code` after every `file_write`
2. **protected files**: Return `MANUAL_APPROVAL_REQUIRED` — never bypass
3. **atomicity**: Don't leave codebase in a broken state
4. **documentation**: Update relevant `docs/*.md` in the same step as code changes

---

## Adding a New Sub-Agent

1. Create `src/<name>.ts` with an `Agent` instance and `export const handler`.
2. Add a new `sst.aws.Function` in `sst.config.ts` with appropriate links.
3. Add a `bus.subscribe('<name>.task', ...)` subscription.
4. Add a new `agentType` enum value in `dispatch_task`'s parameters in `src/tools.ts`.
5. Update this file and `INDEX.md`.
