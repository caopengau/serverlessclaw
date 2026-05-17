# Architectural Audit Report: Brain & Metabolism (Silo 4 & 7)
Date: 2026-05-12
Auditor: Antigravity (AI)
Status: Completed
Scope: packages/core/lib/memory/, packages/core/lib/maintenance/metabolism/, packages/core/handlers/events/

## 1. Executive Summary
This audit focused on the **Memory (Silo 4)** and **Metabolism (Silo 7)** components, specifically evaluating **Multi-Tenant Isolation (Principle 11)** and **Atomic State Integrity (Principle 13)**. While the overall architecture is robust and leverages conditional updates for configuration and promotion, high-frequency message persistence and some telemetry paths exhibit latent race conditions and isolation gaps.

## 2. Findings Summary

| ID | Severity | Silo | Principle | Finding |
| :--- | :---: | :--- | :--- | :--- |
| **01** | **P1** | 4 (Brain) | 13 (Atomic) | Millisecond Collision Overwrites in `addMessage` |
| **02** | **P2** | 4 (Brain) | 13 (Atomic) | Direct Object-Level Overwrites in `saveConversationMeta` |
| **03** | **P2** | 1 (Spine) | 11 (Isolation) | Global Telemetry Leakage in `dlq-handler` |
| **04** | **P2** | 6 (Toolbox) | - | Principles Verifier Gap (Abstracted DynamoDB) |
| **05** | **P2** | 7 (Metab) | 13 (Atomic) | Metabolic Loop Race Condition in `createCollaboration` |

## 3. Detailed Findings

### Finding 01: Millisecond Collision Overwrites (P1)
**Location**: `packages/core/lib/memory/sessions/history-operations.ts:26`
**Issue**: The `addMessage` function uses `Date.now()` as the sort key (`timestamp`) in DynamoDB without any entropy or condition. In high-concurrency scenarios (e.g., parallel agents responding simultaneously), messages arriving in the same millisecond will overwrite each other.
**Recommendation**: Append a random suffix or UUID fragment to the timestamp to ensure uniqueness, or use a conditional write to retry on collision.

### Finding 02: Direct Object-Level Overwrites (P2)
**Location**: `packages/core/lib/memory/sessions/metadata-operations.ts:103`
**Issue**: `saveConversationMeta` performs a read-modify-write pattern on session metadata without optimistic locking or version checks. Concurrent updates to session titles or pins may result in lost updates.
**Recommendation**: Implement version-based optimistic locking similar to `AgentRegistry.saveConfig`.

### Finding 03: Global Telemetry Leakage (P2)
**Location**: `packages/core/handlers/events/dlq-handler.ts`
**Issue**: Health issues reported from the DLQ handler do not include the `workspaceId`, even though it is often available in the event detail. This leads to "telemetry blindness" where tenant-specific failures appear as global system issues.
**Recommendation**: Extract `workspaceId` from the DLQ event detail and propagate it to `reportHealthIssue`.

### Finding 04: Principles Verifier Gap (P2)
**Location**: `scripts/quality/verify-principles.ts`
**Issue**: The automated principle verifier only scanned for `Table.put` and `Table.update` and suffered from false negatives due to `KeyConditionExpression` being mistaken for `ConditionExpression`.
**Status**: **REMEDIATED**. The script now uses word-boundary regex and recognizes abstracted provider methods (`base.putItem`).

### Finding 05: Metabolic Loop Race Condition (P2)
**Location**: `packages/core/lib/memory/collaboration/lifecycle.ts:143`
**Issue**: In `createCollaboration`, the final update to the participant list is performed without a `ConditionExpression`. If participants join concurrently, the entire list could be overwritten with a stale version.
**Recommendation**: Use a conditional update ensuring the `participants` list hasn't changed, or use a `list_append` operation.

### Finding 06: Broad Atomic Update Violations (P2)
**Location**: Multiple files in `packages/core/lib/memory/`
**Issue**: The following files perform updates without `ConditionExpression`, risking race conditions in high-concurrency scenarios:
- `packages/core/lib/memory/sessions/metadata-operations.ts`
- `packages/core/lib/memory/clarification-operations.ts`
- `packages/core/lib/memory/negative-memory.ts`
- `packages/core/lib/memory/reputation-operations.ts`
- `packages/core/lib/memory/insights/metabolic-operations.ts`
- `packages/core/lib/memory/gap/tracks.ts`
**Recommendation**: Migrate these to `atomicUpdateMapEntity` or add optimistic locking.

## 4. Remediation Status
- Finding 01: **REMEDIATED** (Implemented unique micro-timestamp and conditional write in `addMessage`)
- Finding 03: **REMEDIATED** (Propagated `workspaceId` in `dlq-handler.ts`)
- Finding 04: **REMEDIATED** (Expanded verifier logic)
- Finding 02, 05, 06: **Pending** (Scheduled for next sprint)
