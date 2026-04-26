# Audit Report: Perspective D - Trust Loop - 2026-04-24

## 🎯 Objective

Verify that performance data (The Eye) correctly informs reputation (The Scales), which in turn guides agent selection (The Spine), while maintaining strict multi-tenant isolation.

## 🎯 Finding Type

- Bug / Multi-tenant Leak / Inconsistency

## 🔍 Investigation Path

- **Eye (Silo 5)**: Analyzed `core/lib/metrics/metrics.ts` and `core/lib/metrics/token-usage.ts`.
- **Scales (Silo 6)**: Analyzed `core/lib/memory/reputation-operations.ts` and `core/lib/safety/trust-manager.ts`.
- **Spine (Silo 1)**: Analyzed `core/lib/routing/AgentRouter.ts`.
- **Observed**: Missing workspace scoping in routing metrics and global DynamoDB metric fallback.

## 🚨 Findings

| ID  | Title                                     | Type | Severity | Location | Recommended Action |
| :-- | :---------------------------------------- | :--- | :------- | :------- | :----------------- |
| 1   | Global Agent Selection Metrics (MT Leak)  | Bug  | P1       | `AgentRouter.ts:182` | Pass `workspaceId` to `TokenTracker.getRollupRange` in `getMetrics` to isolate agent performance data. |
| 2   | Global Model Selection Metrics (MT Leak)  | Bug  | P1       | `AgentRouter.ts:153` | Pass `workspaceId` to `TokenTracker.getRollupRange` in `weightedModelSelection` to prevent cross-tenant model bias. |
| 3   | Non-Scoped Metric Persistence             | Bug  | P2       | `metrics.ts:50` | Include `workspaceId` in the DynamoDB key in `persistToDynamoDB` to prevent metric collisions. |
| 4   | Redundant Global Token Tracking           | Leak | P2       | `token-usage.ts:114` | The `GLOBAL#TOKEN` copy in `recordInvocation` should be optional or obfuscated to prevent cross-tenant metadata leakage. |

## 💡 Architectural Reflections

The "Trust Loop" is structurally sound but operationally "leaky." While the reputation system (`reputation-operations.ts`) correctly uses the scoping mechanism, the routing backbone (`AgentRouter.ts`) reverts to global defaults when fetching performance metrics. This means an agent that performs poorly in Workspace A might be incorrectly penalized (or favored) in Workspace B based on aggregated data.

To fully satisfy **Principle 14 (Selection Integrity)**, every step of the routing decision—from model weighting to agent selection—must be grounded in tenant-specific data.

## 🔗 Related Anti-Patterns

- **Siloed Fix**: Isolation was added to `Reputation` but missed in `Metrics/Routing`.
- **Global Thinking**: Routing decisions are made using global token rollups.
- **Telemetry Blindness**: The DynamoDB metric fallback loses its tenant context by using a generic key.
