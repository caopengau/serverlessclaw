# System Audit: The Brain (Memory, Identity & Continuity)
**Date**: 2026-04-11
**Auditor**: Gemini CLI

## Overview
Audit of memory persistence, tiered retention, and multi-tenant workspace isolation.

## Findings

### P1: Performance/Cost - Inefficient Semantic Deduplication
*   **Observation**: `findSimilarMemory` in `insight-operations.ts` performs a Keyword Jaccard similarity check against the last 50 items for *every* `addMemory` call.
*   **Impact**: This introduces linear latency (`O(N)` where N=50) and high RCU usage for every memory insertion. As the system scales or if the limit is increased, this will become a major bottleneck.
*   **Recommendation**: Move similarity checks to a vector-based asynchronous process (using the "Hybrid Memory Model" mentioned in ARCHITECTURE.md) or use a more efficient bloom filter for quick negative matches.

### P2: Architectural - Weak Workspace/Org Isolation
*   **Observation**: While some methods like `searchInsights` and `addMemory` accept an `orgId`, the primary partitioning key in `BaseMemoryProvider` is still `userId`. The system relies on prefixes like `ORG#` or `SESSION#` within the `userId` field to achieve isolation.
*   **Impact**: Risk of "leaky" abstractions where one tenant's data could be accessed by another if prefix handling is inconsistent across the 20+ specialized operation files.
*   **Recommendation**: Formalize a `TenantContext` that is passed to all memory operations, ensuring the `userId` (PK) always includes a mandatory `orgId` or `workspaceId` prefix.

### P3: Inconsistency - Redundant Identity Metadata
*   **Observation**: `mapToInsights` in `insight-operations.ts` resolves `userId` and `orgId` from both the top-level DB fields and the nested `metadata` object.
*   **Impact**: Data redundancy and potential for "split-brain" states where the indexed PK doesn't match the record's internal metadata.
*   **Recommendation**: Normalize the schema to store identity fields only at the top level for indexing, or only within metadata for flexibility, but not both.

## Verification Strategy Used
*   Static analysis of `base.ts`, `dynamo-memory.ts`, and its sub-operation files.
*   Review of GSI usage in `insight-operations.ts` and `session-operations.ts`.
*   Audit of `userId` prefixing patterns across different memory types.
