# Audit Report: Perspective C: Identity Journey - 2026-04-25

## 🎯 Objective

Verify identity and permissions propagate correctly across all surfaces (Brain → Spine → Shield). Specifically, I traced how `workspaceId`, `teamId`, `staffId`, and `userRole` flow through the system during dynamic task execution and state resumption.

## 🎯 Finding Type

- Bug / Inconsistency / Gap

## 🔍 Investigation Path

- Started at: `core/handlers/agent-runner.ts` and `core/lib/session/session-state.ts`
- Followed: The extraction of tenant context (`workspaceId`, etc.) from incoming events and how they are emitted back to the bus via `emitTaskEvent`, as well as how `SessionStateManager.getState()` reconstitutes context from DynamoDB.
- Observed: Pervasive dropping of tenant identity context in the Spine and Brain layers, preventing proper multi-tenant isolation and Shield enforcement downstream.

## 🚨 Findings

| ID  | Title | Type | Severity | Location | Recommended Action |
| :-- | :---- | :--- | :------- | :------- | :----------------- |
| 1 | AgentRunner Drops Tenant Identity on Task Completion | Bug | P0 | `core/handlers/agent-runner.ts:286, 318` | Update `emitTaskEvent` calls in `agent-runner.ts` to include `workspaceId`, `teamId`, `staffId`, and `userRole` from the incoming payload. |
| 2 | SessionStateManager.getState() Silently Drops Identity Metadata | Gap | P1 | `core/lib/session/session-state.ts:590` | Update the `SessionState` interface and `getState()` return object to include `workspaceId`, `teamId`, `staffId`, and `userRole` to ensure they are available for workflow resumption. |

## 💡 Architectural Reflections

- **Integration Anti-Pattern (Telemetry/Isolation Leak):** Because `AgentRunner` drops `workspaceId`, downstream processors like `task-result-handler.ts` receive `undefined` for the workspace. This causes the `updateReputation` call in `task-result-handler.ts` to log reputation updates globally rather than scoped to the tenant, polluting the trust model. This is a recurrence of the "Multi-tenant leaks in TrustManager" pattern (Anti-Pattern #8/9).
- **Recovery Path Weakness:** When a workflow is resumed via `workflowSnapshot`, the `SessionStateManager` cannot reconstitute the tenant identity because `getState` drops it. This means the resumed task proceeds without proper tenant context, potentially bypassing `SafetyEngine` RBAC validation checks.
