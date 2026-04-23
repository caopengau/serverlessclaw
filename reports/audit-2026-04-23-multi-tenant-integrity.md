# Audit Report: Multi-Tenant Integrity (Perspectives A & D) - 2026-04-23

## 🎯 Objective

Audited **Silo 4 (The Brain)** and **Silo 6 (The Scales)** through the lenses of **Perspective A (Life of a Message)** and **Perspective D (Trust Loop)**. The primary goal was to verify multi-tenant isolation and the integrity of the agent trust loop.

## 🔍 Investigation Path

- **Perspective A (Brain/Memory)**: Traced `workspaceId` through `StandardExecutor` -> `ToolExecutor` -> `recallKnowledge` -> `searchInsights`.
- **Perspective D (Scales/Reputation)**: Analyzed the reputation update flow from `TaskResultHandler` and `TrustManager` through `reputation_update` events to `handleReputationUpdate`.

## 🎯 Finding Type

- Bug / Security / Performance

## 📊 Findings Summary

| ID | Title | Type | Severity | Location | Recommended Action |
|:---|:------|:-----|:---------|:---------|:-------------------|
| 1 | **Knowledge Context Drop** | Security | P0 | `core/tools/knowledge/storage.ts` | **(FIXED)** Pass `workspaceId` from tool arguments to memory operations. |
| 2 | **Search Isolation Leak** | Security | P0 | `core/lib/memory/insight-operations.ts` | **(FIXED)** Apply `FilterExpression` for workspace isolation at the DynamoDB level. |
| 3 | **Reputation Contamination** | Integrity | P1 | `core/handlers/events/reputation-handler.ts` | **(FIXED)** Propagate `workspaceId` in reputation events to isolate agent trust per tenant. |
| 4 | **Metric Contamination** | Integrity | P1 | `core/lib/metrics/agent-metrics.ts` | **(FIXED)** Scope agent performance metrics by `workspaceId`. |
| 5 | **Inefficient Type Scanning** | Performance | P1 | `TypeTimestampIndex` usage | **(Gap)** Add a workspace-scoped GSI (`workspaceId#type`) to avoid scanning all tenants. |

## 🛠 Actions Taken

1.  **Hardened Memory Tools**: Patched `recallKnowledge`, `saveMemory`, `reportGap`, `manageGap`, `prioritizeMemory`, and `refineMemory` to respect and propagate `workspaceId`.
2.  **Secured searchInsights**: Integrated `applyWorkspaceIsolation` into the `searchInsights` logic to prevent cross-tenant data leakage during category searches.
3.  **Isolated Trust Loop**:
    - Updated `ReputationUpdatePayload` to include multi-tenant context.
    - Updated `TrustManager` to emit scoped reputation events.
    - Patched `handleReputationUpdate` and `recordAgentMetric` to use scoped partition keys.
4.  **Verified Integrity**: Added and executed regression tests for search isolation and tool context propagation.

## 💡 Architectural Reflections

The system's multi-tenancy was found to be "aspirational" in several key areas of the Brain and Scales. While the underlying `BaseMemoryProvider` supported scoping, the high-level tools and event handlers frequently dropped the context, leading to a global "communal" memory and reputation pool. This broke **Principle 11 (Multi-tenant Isolation)**. The fixes applied today restore logical isolation, but the reliance on `FilterExpression` for workspace-level type queries remains a performance bottleneck that must be addressed with a new GSI as the system scales.
