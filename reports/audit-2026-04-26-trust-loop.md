# Audit Report: Perspective D: Trust Loop - 2026-04-26

## 🎯 Objective

Verify the "Trust Loop" (Perspective D: Eye -> Scales -> Spine), focusing on how feedback (failures, anomalies, successes) flows from observation into the `TrustManager` (Scales) and securely updates an agent's trust score without introducing race conditions or fail-open behaviors.

## 🎯 Finding Type

- Bug

## 🔍 Investigation Path

- Started at: `docs/governance/AUDIT.md` and `docs/governance/ANTI-PATTERNS.md` to identify under-audited areas.
- Selected Perspective D: Trust Loop.
- Examined `core/lib/safety/trust-manager.ts` and how it updates agent trust scores.
- Noticed `TrustManager.updateTrustScore` calculated bounds by making a first non-clamped atomic update `AgentRegistry.atomicAddAgentField`, observing the new score, and if out of bounds (`< MIN_SCORE` or `> MAX_SCORE`), issuing a *second* atomic update to correct it.
- Recognized this as a classic race condition (Anti-Pattern: "Direct object-level overwrite instead of atomic update" / "Race condition in TrustManager"). If two processes penalized an agent concurrently near 0, both would observe negative scores and both would apply positive clamping corrections, leading to the agent incorrectly gaining trust.

## 🚨 Findings

| ID  | Title | Type | Severity | Location | Recommended Action |
| :-- | :--- | :--- | :------- | :------- | :----------------- |
| 1 | Race Condition in Trust Score Clamping | Bug | P0 | `core/lib/safety/trust-manager.ts:167` | Replace the two-step `atomicAddAgentField` approach with a retry-based conditional optimistic locking method (`atomicSetAgentTrustScore`) that calculates bounds precisely in memory before atomically verifying and updating DynamoDB. |

## 💡 Architectural Reflections

### Non-Atomic State Clamping in DynamoDB
DynamoDB `UpdateExpression` does not natively support `Math.min()` or `Math.max()`. To implement a bounded metric like `trustScore` (0 to 100), developers historically leaned on an anti-pattern: let DynamoDB do `ADD :val` natively, and if the result escapes the boundary, follow up with another `ADD` to pull it back. This inherently assumes no other process will mutate the score in between the two operations.

In a highly concurrent multi-agent system, multiple failures can be reported to the `TrustManager` simultaneously. When `trustScore` hovers near 0, dual negative updates will produce multiple positive pull-backs, compounding into a net-positive score change (i.e. rewarding an agent for failing).

**Resolution:**
The system was refactored to use an optimistic locking loop. We added `AgentRegistry.atomicSetAgentTrustScore(agentId, expectedOldScore, newScore)`, utilizing DynamoDB's `ConditionExpression`. If the score is modified by another thread mid-calculation, `ConditionalCheckFailedException` is thrown, caught, and gracefully retried. This strictly adheres to Principle 13 (Atomic State Integrity) and eliminates the vulnerability.
