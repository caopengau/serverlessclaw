# Audit Report: The Scales & Trust Loop - 2026-04-25

## 🎯 Objective

Verify the integrity of the **Trust Loop (Perspective D)** across **The Eye** (Metrics), **The Scales** (Trust Manager), and **The Spine** (Routing). Specifically looking for tenant isolation leaks, race conditions, fail-open behaviors, and data consistency.

## 🎯 Finding Type

- Bug / Inconsistency / Refactor

## 🔍 Investigation Path

- Started at: `core/lib/safety/trust-manager.ts` (The Scales)
- Followed: The flow of cognitive metrics from `core/lib/metrics/cognitive/collector.ts` (The Eye) to anomalies, and the token metrics in `core/lib/metrics/token-usage.ts` (The Eye) used by `AgentRouter.ts` (The Spine).
- Observed: Missing tenant isolation in metrics, fail-open error handling in trust score updates, and a malformed DynamoDB query for tool metrics.

## 🚨 Findings

| ID | Title | Type | Severity | Location | Recommended Action |
| :-- | :--- | :--- | :------- | :------- | :----------------- |
| 1 | Cognitive Metrics Collector Ignores Tenant Isolation | Bug | P1 | `core/lib/metrics/cognitive/collector.ts:106` | Add `workspaceId` to `CognitiveMetric` and construct scoped partition keys in `flush()` (e.g., `WS#{wsId}#...`). |
| 2 | Silent Fail-Open in TrustScore Penalty Updates | Bug | P1 | `core/lib/safety/trust-manager.ts:166` | Throw an error instead of returning `fallbackScore` if `atomicAddAgentField` fails. (Anti-Pattern #1) |
| 3 | Unqueryable Tool Token Rollups (Partition Key Mismatch) | Bug | P1 | `core/lib/metrics/token-usage.ts:358, 389` | Remove `#${dateStr}` from the partition key in `updateToolRollup` so `getToolRollupRange` can query by time range on the sort key. |
| 4 | `decayTrustScores` Lacks Pagination/Batched Processing | Refactor | P2 | `core/lib/safety/trust-manager.ts:248` | Replace unbounded `Promise.all` with chunked batch processing to prevent DynamoDB throttling. |

## 💡 Architectural Reflections

- **Fail-Open Anti-Pattern Persistence**: Finding #2 demonstrates that the fail-open anti-pattern is still present in critical path updates. When `atomicAddAgentField` fails, returning a fallback score silently drops trust penalties, violating Principle 15 (Monotonic Progress).
- **Telemetry Blindness**: Finding #3 reveals that tool-level token analytics have been silently failing (returning empty) because the write pattern and read pattern for DynamoDB partition keys diverge. We need integration tests that verify data written by rollups can actually be read back by the range queries.
- **Cross-Tenant Contamination**: Finding #1 shows that while `TokenTracker` is strictly scoped, `MetricsCollector` is completely tenant-blind. This breaks the Trust Loop (Perspective D) because cognitive anomalies are calculated globally, causing failures in Workspace A to penalize the agent in Workspace B.