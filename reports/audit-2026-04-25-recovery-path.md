# Audit Report: Shield → Spine → Brain (Recovery Path) - 2026-04-25

## 🎯 Objective

Verify the integrity of the **Recovery Path (Perspective E)** across **The Shield** (Safety), **The Spine** (Event Routing), and **The Brain** (Memory/Evolution). Focus on atomicity of evolution triggering, fail-closed behavior, and tenant isolation in recovery.

## 🎯 Finding Type

- Bug / Inconsistency / Security

## 🔍 Investigation Path

- Started at: `core/lib/safety/safety-engine.ts` (The Shield)
- Followed: The flow of blocked Class C actions to `core/lib/safety/evolution-scheduler.ts`.
- Observed: Race conditions in proactive evolution triggering and missing integrity checks in the event multiplexer.
- Checked: `core/handlers/recovery.ts` and `core/lib/lock/lock-manager.ts` for recovery flow safety.

## 🚨 Findings

| ID | Title | Type | Severity | Location | Recommended Action |
| :-- | :--- | :--- | :------- | :------- | :----------------- |
| 1 | Double Triggering of Proactive Evolution | Bug | P1 | `core/lib/safety/evolution-scheduler.ts:114` | Use a conditional update (Principle 13) to change status from 'pending' to 'triggered' atomically *before* emitting the event. |
| 2 | Direct Object Overwrite in Evolution State | Bug | P1 | `core/lib/safety/evolution-scheduler.ts:167` | Use `UpdateCommand` with `ConditionExpression` instead of `putItem` to prevent concurrent update loss. |
| 3 | Missing Selection Integrity in Multiplexer | Bug | P1 | `core/handlers/agent-multiplexer.ts` | Call `AgentRegistry.getAgentConfig` and verify `enabled === true` before processing any task (Principle 14). |
| 4 | Race Condition in Gap Lock Cleanup | Bug | P2 | `core/handlers/recovery.ts:79` | Add `ConditionExpression: 'expiresAt < :staleThreshold'` to the `DeleteCommand` to prevent deleting re-acquired locks. |
| 5 | Hardcoded Evolution Prefix | Inconsistency | P3 | `core/lib/safety/evolution-scheduler.ts:9` | Move `EVOLUTION#PENDING#` to `MEMORY_KEYS` in `core/lib/constants/memory.ts`. |

## 💡 Architectural Reflections

- **Trigger-Before-Update Anti-Pattern**: Finding #1 reveals a critical flaw in the evolution loop. Emitting a destructive EventBridge event (Class C) *before* persisting the state change allows for multiple triggers if the persistence fails or if concurrent processes reach the same check.
- **Principle 14 (Selection Integrity) Bypass**: Finding #3 shows that while the `AgentRouter` respects the `enabled` flag, the `AgentMultiplexer` (the final gate) does not. This allows disabled agents to be invoked via direct EventBridge tasks, bypassing the router's safety checks.
- **Non-Atomic Cleanup**: Finding #4 demonstrates that even cleanup logic needs to be atomic. Deleting "stale" records without verifying they are *still* stale at the moment of deletion is a classic race condition that can destabilize distributed locks.

## 🧪 Verification Plan

1. **Reproduction Test**: Create a test in `core/lib/safety/evolution-scheduler.test.ts` that simulates concurrent `triggerTimedOutActions` calls.
2. **Multiplexer Test**: Create a test in `core/handlers/agent-multiplexer.test.ts` that sends a task to a disabled agent and verifies it is rejected.
3. **Lock Cleanup Test**: Create a test that acquires a lock immediately after it's identified as stale by another process and verify the deletion is blocked.
