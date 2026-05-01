# Audit Report: Recovery Path & State Restoration - 2026-05-01

## 🎯 Objective

Audit the "Recovery Path (Shield → Spine → Brain)" (Perspective E) with a focus on system consistency during emergency rollbacks, state restoration, and recovery circuit-breaking.

## 🎯 Finding Type

- Bug
- Fail-Open

## 🔍 Investigation Path

- Started at: `core/handlers/recovery.ts` (The Shield / DMS)
- Followed: Health check failures to CodeBuild rollback trigger.
- Followed: Successful health checks to state reset in `core/handlers/health.ts`.
- Observed: Missing state reset in the periodic DMS handler.
- Followed: Dashboard failure signals in `ClawTracer` to `remediateDashboardFailure`.
- Observed: Fail-open behavior for global/systemic failures.

```text
[ Recovery Path: Perspective E ]

  (Shield)  DeadManSwitch (DMS) -> checkCognitiveHealth()
             |
             +--- [ UNHEALTHY ] ---+
             |  1. Increment recovery_attempts (Brain)
             |  2. Trigger CodeBuild rollback to LKG_HASH (Spine)
             |  3. [FIX] Cleanup stale gap locks (Shield)
             |
             +--- [ HEALTHY ] ---+
                1. [FIX] Reset recovery_attempts (Brain)
                2. [FIX] Cleanup stale gap locks (Shield)

  (Spine)   Tracer.failTrace() -> EventBridge(DASHBOARD_FAILURE_DETECTED)
             |
             v
  (Brain)   handleDashboardFailure() -> MetabolismService.remediate()
             |
             +--- [ MISSING workspaceId ] ---+
                [FIX] Default to 'default' context to allow global repair.
```

## 🚨 Findings

| ID  | Title             | Type | Severity | Location   | Recommended Action |
| :-- | :---------------- | :--- | :------- | :--------- | :----------------- |
| 1   | Sticky Recovery Counter | Bug  | P1       | `core/handlers/recovery.ts` | FIXED. Reset `recovery_attempts` when DMS finds system healthy. |
| 2   | Conservative Lock Cleanup | Bug  | P2       | `core/handlers/recovery.ts` | FIXED. Run `cleanupStaleGapLocks` regardless of health status. |
| 3   | Global Remediation Bypass | Fail-Open | P2 | `core/lib/maintenance/metabolism/remediation.ts` | FIXED. Support global ('default') context for systemic failures. |

## 💡 Architectural Reflections

- **Recovery Loop Closure**: The system previously relied on the "verify" gate (triggered by deployment) to reset recovery state. However, in a distributed environment where DMS runs periodically, it must also be responsible for confirming system restoration and clearing its own circuit-breaker state.
- **Fail-Closed Remediation**: For the Metabolism silo, "not doing anything" on missing context is a form of failing open for the system as a whole. By assuming a global context, we ensure that the system's "Self-Healing" capabilities extend to its own core infrastructure, not just tenant workloads.
- **Principle 13 (Atomic State Integrity)**: The recovery counter increment and reset are correctly implemented using atomic DynamoDB operations, ensuring that concurrent recovery triggers don't corrupt the circuit-breaker logic.
