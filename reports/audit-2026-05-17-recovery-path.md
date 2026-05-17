# Audit Report: Recovery Path (Shield → Spine → Brain) - 2026-05-17

## 🎯 Objective

Verify the integrity and multi-tenant isolation of the system's recovery path, including Dead Man's Switch, DLQ handling, and idempotent resumption.

## 🎯 Finding Type

- Bug / Data Type Mismatch (P1)
- Principle 11 Violation / Anti-Pattern 19 (P1)
- Telemetry Blindness (P2)

## 🔍 Investigation Path

- Started at: `packages/core/handlers/events/dlq-handler.ts` (Failed event handling)
- Followed: `packages/core/handlers/recovery.ts` (Dead Man's Switch logic)
- Observed: `cleanupStaleGapLocks` uses `String()` conversion on a `number` SK in DynamoDB.
- Followed: `packages/core/lib/lifecycle/health.ts` (Deep Health Check)
- Observed: `checkTraceCoherence` uses `ScanCommand` even when `workspaceId` is known.
- Followed: `packages/core/lib/memory/sessions/recovery-operations.ts` (Memory ops)
- Observed: Manual recovery logs in `recovery.ts` lack the `type` attribute.

## 🚨 Findings

| ID  | Title                                               | Type | Severity | Location                                | Recommended Action                                                                        |
| :-- | :-------------------------------------------------- | :--- | :------- | :-------------------------------------- | :---------------------------------------------------------------------------------------- |
| 1   | Type Mismatch in Lock Cleanup                       | Bug  | P1       | `packages/core/handlers/recovery.ts`    | Remove `String()` conversion from `timestamp` in `DeleteCommand`.                         |
| 2   | Inefficient/Leaky Trace Coherence Scan              | Bug  | P1       | `packages/core/lib/lifecycle/health.ts` | Use `QueryCommand` on `WorkspaceSummaryIndex` when `workspaceId` is available.           |
| 3   | Missing `type` in Manual Recovery Logs              | Bug  | P2       | `packages/core/handlers/recovery.ts`    | Add `type: 'DISTILLED'` to all manual `PutCommand` calls for `DISTILLED#RECOVERY`.         |
| 4   | Potential Data Loss in DLQ Routing                  | Bug  | P2       | `packages/core/handlers/events/dlq-handler.ts` | Implement persistence for DLQ events in a dedicated table or use `MemoryTable`.           |

### Finding 1: Type Mismatch in Lock Cleanup (P1)
The `cleanupStaleGapLocks` function in `recovery.ts` attempts to delete stale locks using a `DeleteCommand`. However, it converts the `timestamp` range key to a `string` (`String((item.timestamp as string) || '0')`). Since `MemoryTable` defines `timestamp` as a `number`, these deletions will fail with a `ValidationException`, leading to stale locks persisting indefinitely during system instability.

### Finding 2: In-Memory Multi-Tenant Filtering (P1)
`checkTraceCoherence` in `health.ts` uses `ScanCommand` to retrieve recent traces. While it includes a `FilterExpression` for `workspaceId`, DDB scans are billed and perform based on the total table size before filtering. This violates **Principle 11 (Isolation)** and matches **Anti-Pattern 19**, as one tenant's health check performance is degraded by the volume of other tenants' data.

### Finding 3: Telemetry Blindness in Recovery Logs (P2)
Manual `PutCommand` calls in `recovery.ts` for recovery status updates omit the `type` attribute. Since the dashboard and internal monitoring utilities filter by `type: 'DISTILLED'` to show recovery logs, these critical system events are currently invisible to operators.

## 💡 Architectural Reflections

The recovery path is the system's "Immune System". It must be the most robust part of the codebase. Using manual `db.send` calls instead of unified memory providers in the recovery handler has introduced subtle type bugs and telemetry omissions. We should move towards using `DynamoMemory` or specialized operation helpers even in emergency handlers.
