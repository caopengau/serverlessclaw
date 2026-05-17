# Audit Report: Life of a Message - 2026-05-17

## 🎯 Objective

Audit the "Life of a Message" perspective (Spine ↔ Brain ↔ Eye) to verify end-to-end message flow integrity from receipt to response, specifically looking for Anti-Patterns 12, 14, and 19.

## 🎯 Finding Type

Bug / Refactor

## 🔍 Investigation Path

- Started at: `packages/core/lib/utils/bus/dlq.ts` (Spine)
- Followed: `packages/core/lib/memory/insights/query-operations.ts` (Brain)
- Observed: Missing condition expression on DLQ item insertion (Anti-Pattern 12), and in-memory filtering of insights (Anti-Pattern 19).

## 🚨 Findings

| ID  | Title             | Type | Severity | Location   | Recommended Action |
| :-- | :---------------- | :--- | :------- | :--------- | :----------------- |
| 1   | Millisecond Collision Overwrites in DLQ | Bug  | P1       | `packages/core/lib/utils/bus/dlq.ts` | Added `ConditionExpression` with micro-jitter retry loop to prevent data loss. Related to Anti-Pattern 12. |
| 2   | In-Memory Multi-Tenant Isolation Breach in Insights | Bug | P1 | `packages/core/lib/memory/insights/query-operations.ts` | Pushed `InsightCategory` filtering to DynamoDB `FilterExpression` instead of in-memory `.filter()`. Related to Anti-Pattern 19. |

## 💡 Architectural Reflections

The system is generally robust, but areas relying on dynamic metadata filtering (like tags and categories in insights) were occasionally falling back to in-memory filtering. We need to enforce a pattern where all DDB scans and queries strictly utilize `FilterExpression` for metadata whenever possible to avoid starvation and hitting pagination limits prematurely.
