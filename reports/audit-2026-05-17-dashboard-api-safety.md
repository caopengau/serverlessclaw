# Audit Report: Perspective G (Dashboard Integrity) - 2026-05-17

## 🎯 Objective

Verify the integrity of cross-silo APIs within the Dashboard, focusing on tenant isolation (Perspective G). The goal is to ensure that all Dashboard APIs correctly pass `workspaceId` downstream to the Core Framework (Spine, Memory, Metabolism) to prevent data leakage and multi-tenant bleeding (Anti-Patterns 14, 19, and 22).

## 🎯 Finding Type

- Bug / Inconsistency

## 🔍 Investigation Path

- Started at: `apps/dashboard/src/app/api/**/*.ts`
- Followed: Data retrieval patterns using `memory.queryItems`, `memory.get`, and write operations like `setGap`, `updateGapStatus`, `updateDistilledMemory`.
- Observed: Several API endpoints were neglecting to extract `workspaceId` from requests or intentionally omitting it when invoking `BaseMemoryProvider` and `MetabolismService` functions. This omission defaulted these operations to a global scope, thereby breaking multi-tenant isolation boundaries.

## 🚨 Findings

| ID  | Title | Type | Severity | Location | Recommended Action |
| :-- | :---- | :--- | :------- | :------- | :----------------- |
| 1 | Agent Metrics Multi-tenant Leak | Bug | P1 | `apps/dashboard/src/app/api/agents/[id]/metrics/route.ts` | **FIXED**: Included `WS#${workspaceId}#` prefix for DynamoDB partition keys to prevent global querying of metrics. (Anti-Pattern 14 & 19) |
| 2 | Metabolic Blindness in Dashboard | Bug | P1 | `apps/dashboard/src/app/api/system/metabolism/route.ts` | **FIXED**: Extracted `workspaceId` and passed it to `MetabolismService.runMetabolismAudit` to avoid a global/tenant-blind cleanup loop. (Anti-Pattern 22) |
| 3 | Gap Plan Retrieval Isolation Breach | Bug | P1 | `apps/dashboard/src/app/api/memory/gap/plan/route.ts` | **FIXED**: Extracted and passed `{ workspaceId }` to `memory.getDistilledMemory` to restrict reads to the tenant's workspace. |
| 4 | Global Gap Creation | Bug | P1 | `apps/dashboard/src/app/api/memory/gap/route.ts` | **FIXED**: Extracted and passed `{ workspaceId }` to `memory.setGap`. |
| 5 | Memory Metadata Isolation Breach | Bug | P1 | `apps/dashboard/src/app/api/memory/prioritize/route.ts`, `apps/dashboard/src/app/api/memory/status/route.ts` | **FIXED**: Passed `{ workspaceId }` to `updateInsightMetadata` and `updateGapStatus`. |
| 6 | Gap Refinement Data Leak | Bug | P1 | `apps/dashboard/src/app/api/memory/gap/refine/route.ts` | **FIXED**: Supplied `{ workspaceId }` to `updateGapMetadata`, `updateGapStatus`, `updateDistilledMemory`, and `addLesson` to maintain strict tenant bounds. |

## 💡 Architectural Reflections

The Next.js App Router API directory in the Dashboard is prone to forgetting multi-tenant scoping due to the manual nature of extracting `workspaceId` and passing it to the `@claw/core/lib/memory` functions. The `withApiHandler` wrapper provides a structured body parsing mechanism but does not automatically enforce or inject `workspaceId` into a localized `Memory` instance. 

**Recommendation:** Consider instantiating the `DynamoMemory` class or a unified `CoreServices` object with the `workspaceId` embedded at construction within `withApiHandler`. This would eliminate the need for every API route to manually extract and pass the scope to every individual memory operation, drastically reducing the surface area for Anti-Pattern 19.
