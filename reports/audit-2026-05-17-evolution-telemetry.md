# Audit Report: Evolution Telemetry & Session Integrity (2026-05-17)

## Scope
- **Silos**: 1 (Spine), 2 (Hand), 4 (Brain), 5 (Eye), 6 (Scales), 7 (Metabolism)
- **Perspectives**: B (Evolution Cycle), D (Trust Loop), F (Metabolic Loop)

## Summary
This audit focused on resolving deep-seated **Telemetry Blindness** in the self-evolution and metabolic layers, hardening **Session Management** against edge-case race conditions during agent handoffs, and eliminating **Domain Pollution** (Anti-Pattern 20) in the framework-level audit paths.

## Findings & Remediations

### 1. Telemetry Blindness (Silo 5, 6, 7) - [CRITICAL]
- **Issue**: Several critical evolution events were recorded in logs/DynamoDB but lacked CloudWatch metrics, creating "blind spots" for dashboarding and automated scaling.
  - `TrustManager`: Missing metrics for trust bumps, penalties, and batch anomalies.
  - `NegativeMemory`: Missing metrics for failed plans (Silo 4).
  - `MetabolismService`: Missing metrics for autonomous repairs (tool pruning, gap archival, culling, S3 reclamation).
- **Remediation**:
  - Added `EvolutionTrustDelta`, `EvolutionTrustScore`, `EvolutionFailedPlanCount`, and `MetabolismRepairCount` to the metrics registry.
  - Integrated `EVOLUTION_METRICS` calls into `TrustManager`, `NegativeMemory`, and `MetabolismService`.
  - Updated `persistence.ts` to ensure these metrics are durably persisted to DynamoDB during fallback.

### 2. Session Race Conditions (Silo 1) - [HIGH]
- **Issue**: `SessionLockHandler.acquire` lacked a `ConditionExpression`, allowing potential race conditions where one agent could overwrite another's session ownership if the distributed lock registry and the state table were out of sync.
- **Issue**: `SessionStateManager.releaseProcessing` released the distributed lock *before* clearing the session state, creating a window for inconsistent handoffs.
- **Remediation**:
  - Added atomic `ConditionExpression` to `SessionLockHandler.acquire` to verify state ownership before acquisition.
  - Re-ordered `releaseProcessing` to clear DynamoDB state *first* and then release the distributed lock in a `finally` block.

### 3. Domain Pollution / Framework Integrity (Anti-Pattern 20) - [MEDIUM]
- **Issue**: `MetabolismService` hardcoded `/core` in its audit paths, making the framework dependent on a specific directory structure.
- **Remediation**:
  - Introduced `metabolism_scan_path` configuration via `ConfigManager`.
  - Replaced hardcoded paths with configurable, resolved paths in `runMcpAudit` and `runNativeAudit`.

## Verification Status
- [x] **Unit Tests**: Session race condition tests passed (3/3).
- [x] **Integration Tests**: Full core test suite verified via `vitest`.
- [x] **Quality Gates**: Linting and type-checks passed.

## Next Steps
- Audit **Perspective A (Life of a Message)** for performance bottlenecks in the event bus.
- Investigate **Silo 4 (The Brain)** vector store integration for multi-tenant isolation (milestone gap).
