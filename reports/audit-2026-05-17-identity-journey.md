# Audit Report: Identity Journey & RBAC - 2026-05-17

## 🎯 Objective

Verify identity and permissions propagate correctly across all surfaces (Brain → Spine → Shield) and ensure multi-tenant isolation.

## 🎯 Finding Type

- Bug / Security Vulnerability (P0)
- Principle 13 Violations (P2)

## 🔍 Investigation Path

- Started at: `packages/core/handlers/agent-runner.ts` (Permission checks)
- Followed: `packages/core/lib/utils/normalize.ts` (`normalizeBaseUserId`)
- Observed: `normalizeBaseUserId` strips `CONV#` prefix, which is used for internal storage IDs.
- Followed: `packages/core/adapters/input/telegram.ts`
- Observed: External inputs are not sanitized for internal prefixes like `CONV#`.

## 🚨 Findings

| ID  | Title                                           | Type | Severity | Location                        | Recommended Action                                                                        |
| :-- | :---------------------------------------------- | :--- | :------- | :------------------------------ | :---------------------------------------------------------------------------------------- |
| 1   | Identity Spoofing via `CONV#` prefix            | Bug  | P0       | `packages/core/lib/utils/normalize.ts` | Sanitize `userId` in `normalizeMessage` and `normalizeBaseUserId` to prevent spoofing. |
| 2   | Principle 13 violation in `notification-manager` | Bug  | P2       | `notification-manager.ts:1`     | Use `atomicUpdateMapField` for conditional updates.                                       |
| 3   | Principle 13 violation in `recovery-operations`  | Bug  | P2       | `recovery-operations.ts:1`      | Use `atomicUpdateMapField` for conditional updates.                                       |

### Finding 1: Identity Spoofing (P0)
The `normalizeBaseUserId` function strips the `CONV#` prefix used for internal DynamoDB partitioning (`CONV#userId#sessionId`). If an external user provides a `userId` like `CONV#SYSTEM#evil`, the function returns `SYSTEM`. Since `agent-runner.ts` and `SafetyEngine` treat `SYSTEM` as a privileged user that bypasses most RBAC checks, an external attacker can spoof the `SYSTEM` identity to execute arbitrary tools and access any workspace (if they know the `workspaceId`).

## 💡 Architectural Reflections

Internal storage prefixes should NEVER be accepted from external input adapters. The `InboundMessage` normalization layer must be the "Hard Shell" that prevents internal protocol leaking to the outside world.
