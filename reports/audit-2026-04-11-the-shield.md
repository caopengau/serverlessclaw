# System Audit: The Shield (Survival & Perimeter)
**Date**: 2026-04-11
**Auditor**: Gemini CLI

## Overview
Audit of safety guardrails, recovery mechanisms, and perimeter security (IAM).

## Findings

### P0: Security & Context Collision - Improper Idempotency Key in AgentRunner
*   **Observation**: `AgentRunner.ts` uses `traceId` as the `idempotencyKey` when calling `emitTaskEvent`.
*   **Impact**: If a single trace (e.g., a complex plan) results in multiple distinct tasks or agent responses, only the first one will trigger a notification. Subsequent responses within the same trace will be silently suppressed by the `Notifier` or downstream event handlers because they share the same `traceId`.
*   **Recommendation**: Use a more granular key, such as `taskId` or a combination of `traceId` and `agentId`, as the idempotency key.

### P1: Performance/Cost - Inefficient Stale Lock Cleanup
*   **Observation**: `recovery.ts` performs a full `ScanCommand` on the `MemoryTable` to find and delete stale gap locks during every maintenance cycle (every 15 minutes).
*   **Impact**: As the system grows, this scan will become increasingly expensive in terms of RCU/WCU and latency, potentially impacting other session operations on the same table.
*   **Recommendation**: Use a Global Secondary Index (GSI) on `type` and `expiresAt` to perform targeted queries for stale locks, or leverage DynamoDB's native TTL feature if the 1-hour "orphaned" window can be relaxed.

### P1: Reliability - Brittle GapID Resolution in BuildMonitor
*   **Observation**: `BuildMonitor.ts` attempts to resolve `gapIds` from multiple sources, including CodeBuild environment variables as a fallback.
*   **Impact**: If `BatchGetBuilds` returns a truncated environment variable list or if the DDB `BUILD_GAPS` record is missing, the monitor may fail to transition gaps to `DEPLOYED`, leaving the system in an inconsistent state.
*   **Recommendation**: Ensure `BUILD_GAPS` is written atomically with the build trigger and use it as the single source of truth.

### P2: Observability - Health Issues lack "Survival" Subscriber
*   **Observation**: `reportHealthIssue` emits a `SYSTEM_HEALTH_REPORT` event, but there is no dedicated "Survival" or "SRE" agent that subscribes to these for proactive (non-rollback) remediation.
*   **Impact**: Minor health issues may go unaddressed until they trigger the Dead Man's Switch (rollback), which is a heavy-handed response.
*   **Recommendation**: Introduce a `HealthAuditor` or `SurvivalAgent` to triage and potentially fix minor health issues autonomously.

## Verification Strategy Used
*   Static analysis of `infra/deployer.ts`, `core/handlers/monitor.ts`, and `core/handlers/recovery.ts`.
*   Cross-referencing idempotency logic in `AgentRunner.ts` against `notifier.ts` and `events.ts`.
*   Review of IAM policy scoping in `deployer.ts`.
