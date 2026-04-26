# Audit Report: Perspective C - Identity Journey - 2026-04-24

## 🎯 Objective

Verify that identity and permissions propagate correctly and are enforced across the Brain (Memory/Identity), Spine (Routing/Execution), and Shield (Safety/Enforcement).

## 🎯 Finding Type

- Bug / Gap / Inconsistency / Refactor

## 🔍 Investigation Path

- **Started at**: `core/lib/session/identity/manager.ts` to understand the identity model.
- **Followed**: `core/handlers/webhook.ts` and `dashboard/src/app/api/auth/login/route.ts` to trace entry points.
- **Analyzed**: `core/handlers/agent-runner.ts` and `core/lib/agent.ts` to trace propagation in the Spine.
- **Observed**: Missing authentication at entry points and missing permission checks during agent invocation.

## 🚨 Findings

| ID  | Title                                     | Type | Severity | Location | Recommended Action |
| :-- | :---------------------------------------- | :--- | :------- | :------- | :----------------- |
| 1   | Unauthenticated Webhook Entry Point       | Bug  | P0       | `webhook.ts:50` | Call `IdentityManager.authenticate` in the webhook handler to verify platform-provided `userId`. |
| 2   | Dashboard Auth Disconnected from Identity | Gap  | P1       | `dashboard/.../login/route.ts` | Integrate dashboard login with `IdentityManager` to enable per-user granular permissions. |
| 3   | Missing Agent Invocation Permission       | Bug  | P1       | `agent-runner.ts:40` | Verify user permission to invoke the specific agent and access the workspace before execution. |
| 4   | Insecure Registry Access                  | Bug  | P2       | `AgentRegistry.ts:54` | Ensure `getAgentConfig` validates workspace membership before returning sensitive config data. |
| 5   | Non-Atomic User Identity Updates          | Bug  | P1       | `identity/manager.ts:343` | Use `UpdateCommand` with `ConditionExpression` in `saveUser` and `updateUserRole` to prevent data loss (Principle 13). |
| 6   | System-Wide Identity Blindness            | Gap  | P1       | `Agent.ts:55` | The `Agent` class should verify the calling user's identity before starting long-running cognitive loops. |

## 💡 Architectural Reflections

The system has a robust Identity and Access Management (IAM) model defined in `core/lib/session/identity/`, but it exists in isolation. The "Identity Journey" is incomplete because the entry points (Webhooks, Dashboard) do not "check-in" with the Brain, and the Spine blindly trusts the payload identity. This creates a large attack surface where a compromised or spoofed signal can trigger sensitive agent actions without verification.

Furthermore, `IdentityManager` violates Principle 13 (Atomic State Integrity) by using direct object-level overwrites for user roles and workspace membership, which will lead to state drift under concurrent administrative actions.

## 🔗 Related Anti-Patterns

- **Anti-Pattern 6**: Direct Object-Level Overwrites (found in `IdentityManager.saveUser`)
- **Anti-Pattern 7**: Missing Conditional Update (found in `IdentityManager.saveUser`)
- **Telemetry Blindness**: The system propagates identity strings but is "blind" to their validity.
