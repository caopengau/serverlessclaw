# Audit Report: The Spine (Nervous System & Flow) - 2026-04-14

## 🎯 Objective

Deep-dive audit of the system vertical responsible for event routing, distributed coordination, and session state integrity.

## 🔍 Investigation Path

- Started at: `core/lib/backbone.ts` to identify agent configurations.
- Followed: `core/lib/event-routing.ts` and `core/handlers/events/strategic-tie-break-handler.ts` to trace event dispatching logic.
- Observed: Inconsistency in naming between `AgentType` and `EventType`.
- Followed: `core/lib/lock/lock-manager.ts` and `core/lib/session/session-state.ts` to verify atomic state integrity.
- Observed: Non-atomic list updates in `SessionStateManager` leading to race conditions.
- Followed: `infra/agents.ts` to verify EventBridge subscription patterns.
- Observed: QA coverage limited to `CODER_TASK`.

## 🚨 Findings

| ID  | Title                               | Type           | Severity | Location                                | Recommended Action                                                                                                 |
| :-- | :---------------------------------- | :------------- | :------- | :-------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| 1   | Strategic Tie-break Dead End        | Bug            | P0/P1    | `strategic-tie-break-handler.ts:57-58`  | Use `EventType` constants instead of string concatenation to ensure valid event emission.                         |
| 2   | Session State Data Loss Race        | Bug            | P1       | `session-state.ts:184-190, 222-230`     | Implement `ConditionExpression` (e.g., version check or `pendingMessages = :old`) to prevent data loss.            |
| 3   | Agent ID vs Event Type Inconsistency | Inconsistency  | P2       | `types/agent.ts`, `backbone.ts`         | Normalize naming conventions (all underscores or consistent mapping) to prevent brittle event generation.          |
| 4   | QA Verification Coverage Gap        | Gap            | P2       | `infra/agents.ts`, `agent-multiplexer.ts` | Expand `StandardMultiplexer` subscriptions to include research/planning outputs for full semantic audit.            |

## 💡 Architectural Reflections

The system's reliance on manual string manipulation for event types (`${agentId}_task`) is a recurring source of fragility. A central "Spine Gateway" should handle all event emissions, performing automatic mapping and normalization.

The `SessionStateManager` is correctly utilizing `LockManager` for mutual exclusion, but the subsequent list operations are not utilizing DynamoDB's optimistic locking capabilities, creating a significant risk of losing messages that arrive during a task's finalization.

### Verified Critical Failures:
1.  **Strategic Planner** tie-breaks emit `strategic-planner_task` (invalid) instead of `strategic_planner_task` (expected). Result: Task hangs forever.
2.  **Concurrency Race**: If a user sends a message while an agent is finishing its turn and clearing its lock, the new message added to `pendingMessages` may be overwritten and deleted silently.
