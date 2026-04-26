# Audit Report: Perspective C: Identity Journey - 2026-04-26

## 🎯 Objective

Verify the "Identity Journey" (Perspective C: Brain -> Spine -> Shield), specifically how identity and permissions (such as `workspaceId`, `teamId`, `staffId`) propagate correctly across all surfaces from the entry point through the routing layer to the execution shield.

## 🎯 Finding Type

- Bug 

## 🔍 Investigation Path

- Started at: `docs/governance/AUDIT.md` and `docs/governance/ANTI-PATTERNS.md` to identify under-audited areas.
- Selected Perspective C: Identity Journey.
- Followed: Examined webhook entry points (`core/handlers/webhook.ts`), session state lock acquisition (`core/lib/session/session-state.ts`), and agent routing (`core/handlers/agent-runner.ts`).
- Observed: Missing propagation of the identity scope parameter (`workspaceId`, `teamId`, `staffId`) during session lock acquisition, causing the session to drop tenant context.

## 🚨 Findings

| ID  | Title | Type | Severity | Location | Recommended Action |
| :-- | :--- | :--- | :------- | :------- | :----------------- |
| 1 | Dropped Workspace/Tenant Scope on Session Lock Acquisition (`webhook.ts`) | Bug | P0 | `core/handlers/webhook.ts:185` | Update `sessionStateManager.acquireProcessing(chatId, lambdaRequestId, { workspaceId, teamId, staffId })` to correctly pass the identity scope. |
| 2 | Dropped Workspace/Tenant Scope on Session Lock Acquisition (`agent-runner.ts`) | Bug | P0 | `core/handlers/agent-runner.ts:97` | Update `sessionStateManager.acquireProcessing(sessionId, agentId, { workspaceId, teamId, staffId })` to propagate the scope correctly. |

## 💡 Architectural Reflections

### Context Dropping in `SessionStateManager.acquireProcessing`
The `SessionStateManager.acquireProcessing` method accepts an optional third argument `scope` containing `{ workspaceId, teamId, staffId }`. If this argument is omitted, the DynamoDB UpdateCommand explicitly sets `workspaceId = null` (and similar for teamId/staffId). 

Because `webhook.ts` (the "Brain" entry point) and `agent-runner.ts` (the "Spine" worker) fail to pass this `scope` parameter when calling `acquireProcessing`, any active session effectively has its tenant context wiped out in the database. 

When a session lock is released and pending messages are re-emitted (B3 Awareness / P0 Reliability Fix), they are re-emitted with `workspaceId: null`. This breaks tenant isolation and causes downstream components (like `AgentRouter` and `SafetyEngine` in the "Shield") to evaluate actions without the correct workspace context, potentially leading to unauthorized resource access or cross-tenant data contamination.

**Related Anti-Patterns**: 
- **Siloed Fixes**: A previous audit ("audit-2026-04-24-identity-journey.md") fixed unauthenticated webhooks but missed validating the full propagation of the authenticated scope into the session state manager. 
- **Missing Scope Validation**: Functions that mutate state must enforce that required contextual dimensions (like `workspaceId` in a multi-tenant system) are explicitly passed. Making `scope` optional in `acquireProcessing` was an architectural misstep that allowed this bug to go unnoticed by the TypeScript compiler.
