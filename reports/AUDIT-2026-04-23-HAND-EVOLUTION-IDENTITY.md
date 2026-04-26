# Audit Report: The Hand, Evolution Cycle & Identity Journey
**Date**: 2026-04-23
**Auditor**: Gemini CLI
**Silo**: 2 (The Hand)
**Perspectives**: B (Evolution Cycle), C (Identity Journey)

## 🎯 Focus Areas
- **Silo 2 (The Hand)**: Tool execution boundary and agent intent.
- **Perspective B (Evolution Cycle)**: Autonomous evolution safety and trust integrity.
- **Perspective C (Identity Journey)**: Identity propagation and RBAC across the swarm.

## 🔍 Findings

### 1. P1 Inconsistency: Truncated Class C List in SafetyEngine
- **Location**: `core/lib/safety/safety-engine.ts:27`
- **Issue**: `SafetyEngine.ts` defines a local `const CLASS_C_ACTIONS = ['deployment', 'shell_command', 'code_change', 'iam_change']`. This list is used by `normalizeSafetyAction` which is called by `evaluateAction`.
- **Impact**: Official Class C actions defined in `core/lib/constants/safety.ts` (e.g., `infra_topology`, `memory_retention`, `tool_permission`, `policy_update`) are NOT recognized by the normalization logic. If a tool call specifies one of these as its `safetyAction`, `normalizeSafetyAction` returns it as-is. However, if the tool name heuristics also fail, these actions may not be correctly classified, leading to a bypass of **Blast Radius Tracking** (Principle 13).
- **Anti-Pattern**: [3. Fail-Open Defaults] - By not recognizing all Class C actions, the system may treat them as generic actions with lower scrutiny.

### 2. P1 Gap: Broken Proactive Evolution Cycle
- **Location**: `core/handlers/events/strategic-tie-break-handler.ts`, `core/lib/safety/evolution-scheduler.ts`
- **Issue**: When a Class C action times out in HITL mode, `EvolutionScheduler` triggers a `STRATEGIC_TIE_BREAK`. The handler `handleStrategicTieBreak` re-emits the task to the agent but fails to include any approval flags or `approvedToolCalls`.
- **Impact**: The agent receives the task, attempts to execute the tool again, and is blocked again by the `SafetyEngine` because it's still a Class C action requiring approval. This creates an infinite loop or a permanent block, contradicting Principle 9 and the "Proactive Trunk Evolution" promise in `PRINCIPLES.md`.
- **Anti-Pattern**: [1. Fail-Safe vs. Fail-Closed] - The system "fails closed" but doesn't provide a recovery path for autonomous evolution as designed.

### 3. P1 Bug: Identity & Workspace Propagation Failure
- **Location**: `core/agents/coder.ts`, `core/agents/strategic-planner.ts`
- **Issue**: Individual agent handlers extract the `AgentPayload` but fail to destructure `workspaceId`, `teamId`, and `staffId`. Consequently, these fields are NOT passed to `processEventWithAgent` or the underlying `Agent.stream/process` calls.
- **Impact**: **Multi-tenancy and RBAC are compromised**. `ToolSecurityValidator` receives an undefined `workspaceId`, causing `IdentityManager.hasPermission` to bypass workspace-scoped checks and potentially allowing global permissions to override local restrictions. Resource ACL checks are also likely to fail or use incorrect defaults.
- **Anti-Pattern**: [Hidden State/Logic] - Identity state is "hidden" because it's in the payload but not propagated through the execution stack.

### 4. Technical Debt: Inefficient IdentityManager Initialization
- **Location**: `core/lib/agent/tool-security.ts`
- **Observation**: `ToolSecurityValidator` instantiates `new IdentityManager(new BaseMemoryProvider())` on every `validate` call. This results in redundant object creation and DynamoDB client initialization (even if cached by SDK).
- **Suggestion**: Use a singleton or pass the `IdentityManager` instance via `ExecutionExContext`.

## 💡 Architectural Reflections
- The "Spine" (Event Routing & Multiplexing) is becoming complex. The dual path between `Agent Runner` (which handles identity correctly) and individual handlers (which don't) is a source of bugs.
- **Silo 3 (The Shield)** needs a more robust way to "unlock" gates for proactive evolution. A signed `proactiveToken` or a specific metadata flag recognized by `SafetyEngine` is required.

## ✅ Action Items
| ID | Description | Type | Severity | Location | Recommended Fix |
| :--- | :--- | :--- | :------- | :--------- | :----------------- |
| 1 | Sync CLASS_C_ACTIONS in SafetyEngine | Bug | P1 | `core/lib/safety/safety-engine.ts` | Import `CLASS_C_ACTIONS` from constants and use in `normalizeSafetyAction`. |
| 2 | Fix Proactive Evolution Loop | Bug | P1 | `core/handlers/events/strategic-tie-break-handler.ts` | Pass `approvedToolCalls` or set a `bypassSafety` flag in metadata for tie-break tasks. |
| 3 | Propagate Workspace Identity | Bug | P1 | `core/agents/*.ts` | Destructure `workspaceId`, `teamId`, `staffId` and pass to `processEventWithAgent`. |
| 4 | Add heuristics for missing Class C actions | Debt | P2 | `core/lib/safety/safety-engine.ts` | Add `normalizeSafetyAction` cases for `infra_topology`, `iam_change`, etc. |
