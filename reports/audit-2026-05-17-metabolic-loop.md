# Audit Report: Perspective F (Metabolic Loop) - 2026-05-17

## 🎯 Objective

Verify the integrity of the Metabolic Loop (Metabolism ↔ Scales ↔ Spine). Ensure that autonomous self-healing, cleanup, and maintenance tasks are idempotent and correctly scoped to avoid cross-tenant leakage or double-execution of background logic (Anti-Patterns 16 and 22).

## 🎯 Finding Type

- Bug / Inconsistency
- Idempotency Violation

## 🔍 Investigation Path

- Started at: `packages/core/handlers/maintenance.ts`
- Followed: Calls to `TrustManager.decayTrustScores()`, `MetabolismService.runMetabolismAudit()`, and various repair functions in `repairs.ts`.
- Observed: Maintenance tasks such as `cullResolvedGaps` and `pruneStaleFlags` lacked `ConditionExpression` guards on delete/update operations, leading to non-idempotent behavior. Additionally, `archiveStaleGaps` was missing `workspaceId` propagation to metrics, causing metabolic blindness in telemetry.

## 🚨 Findings

| ID  | Title | Type | Severity | Location | Recommended Action |
| :-- | :---- | :--- | :------- | :------- | :----------------- |
| 1 | Non-Idempotent Gap Culling | Bug | P1 | `packages/core/lib/memory/gap/maintenance.ts` | **FIXED**: Added `ConditionExpression: 'attribute_exists(userId)'` to `cullResolvedGaps` to prevent double-counting/logging of deletions in concurrent runs. (Anti-Pattern 16) |
| 2 | Telemetry Blindness in Gap Archival | Bug | P2 | `packages/core/lib/memory/gap/maintenance.ts` | **FIXED**: Propagated `workspaceId` into `ExpressionAttributeValues` for `updateItem` in `archiveStaleGaps` to ensure scoped metrics. (Anti-Pattern 22) |
| 3 | Non-Idempotent Feature Flag Pruning | Bug | P1 | `packages/core/lib/feature-flags.ts` | **FIXED**: Added `conditionExpression` to `ConfigManager.deleteConfig` and used it in `pruneStaleFlags` to ensure atomic removal from the flag list. (Anti-Pattern 16) |
| 4 | Missing Idempotency in ConfigManager.deleteConfig | Inconsistency | P2 | `packages/core/lib/registry/config/base.ts` | **FIXED**: Updated `deleteConfig` signature to support `ConditionExpression`, enabling idempotency for all configuration deletions. |

## 💡 Architectural Reflections

Maintenance loops in serverless environments are prone to concurrent execution during overlap periods. Without explicit `ConditionExpression` guards, metrics (e.g., "Pruned X items") can be inflated, leading to false signals in the Trust Loop (Perspective D). The framework should move toward mandatory idempotency guards for all maintenance-triggered deletions.
