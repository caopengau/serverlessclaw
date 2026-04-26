# Audit Report: Agentic Swarm (Silo 2 The Hand + Silo 7 Metabolism + Perspective A)

**Date:** 2026-04-24  
**Auditor:** serverless-claw-auditor  
**Scope:** Agentic Swarm Decomposition, Parallel Dispatch, Selection Integrity, DAG Execution  
**Silos:** Silo 2 (The Hand — Lambda / Eventing), Silo 7 (Metabolism — Metrics / Telemetry)  
**Perspective:** A — Life of a Message (Swarm decomposition → Parallel dispatch → Aggregation)

---

## Executive Summary

This audit focused on the **Agentic Swarm** subsystem, which enables parallel task decomposition and dispatch across multiple agents. Three critical issues were identified and resolved:

1. **DAG-Awareness Failure (P1):** `swarm-orchestrator.ts` ignored sub-task dependencies from the decomposer, breaking dependency-aware execution.
2. **Selection Integrity Gap (P1):** `agent-runner.ts` executed agents without verifying they were enabled, violating Principle 14.
3. **Observability Blind Spot (P2):** No metrics tracked swarm decomposition rate, parallel dispatch scale, or completion outcomes.

---

## Findings

### Finding 1: DAG-Awareness Failure in Swarm Orchestrator

**File:** `core/lib/agent/swarm-orchestrator.ts`  
**Severity:** P1 — High  
**Principle:** P13 (Atomic State Integrity), P15 (Monotonic Progress)

**Issue:** The orchestrator mapped decomposed sub-tasks to `PARALLEL_TASK_DISPATCH` events but always set `dependencies: []`, even when the decomposer had produced valid dependency chains. This caused the `parallel-handler.ts` to treat all tasks as independent, defeating the DAG execution engine in `dag-executor.ts`.

**Root Cause:** The code created task events without reading `sub.dependencies` from the `PlanSubTask` objects.

**Fix:** Build a `taskIdMap` from `sub.order → sub.subTaskId`, then convert dependency order indices to actual taskIds:

```typescript
const taskIdMap = new Map<number, string>();
decomposed.subTasks.forEach((sub) => {
  taskIdMap.set(sub.order, sub.subTaskId);
});

const dependsOn = sub.dependencies
  .map((depOrder) => taskIdMap.get(depOrder))
  .filter((id): id is string => id !== undefined);
```

**Verification:** The `parallel-handler.ts` already checks `hasDependencies` and routes to DAG mode; with this fix, the dependency chain is preserved end-to-end.

---

### Finding 2: Selection Integrity Gap in Agent Runner

**File:** `core/handlers/agent-runner.ts`  
**Severity:** P1 — High  
**Principle:** P14 (Selection Integrity)

**Issue:** `agent-runner.ts` called `initAgent(agentId)` directly without checking if the agent was enabled in `AgentRegistry`. A disabled agent (e.g., due to circuit breaker, trust score, or admin action) could still be dispatched and execute.

**Fix:** Added a pre-flight check using `AgentRegistry.getAgentConfig` with workspace-scoped resolution:

```typescript
const { AgentRegistry } = await import('../lib/registry/AgentRegistry');
const agentConfig = await AgentRegistry.getAgentConfig(agentId, {
  workspaceId,
  teamId,
  staffId,
});
if (!agentConfig) return `Error: Agent ${agentId} not found`;
if (agentConfig.enabled !== true) return `Error: Agent ${agentId} is disabled`;
```

**Impact:** Prevents execution of disabled agents, ensuring trust-driven mode (Principle 9) and circuit breaker actions are respected at runtime.

---

### Finding 3: Missing Swarm Health Telemetry

**Files:** `core/lib/metrics/metrics.ts`, `core/handlers/events/task-result-handler.ts`, `core/handlers/events/parallel-barrier-timeout-handler.ts`  
**Severity:** P2 — Medium  
**Principle:** P10 (Lean Evolution), P11 (Observability)

**Issue:** No metrics existed to track:
- How often swarm decomposition occurs
- How many sub-tasks are generated per decomposition
- Parallel dispatch success/failure rates
- Barrier timeout frequency

**Fix:** Added three new metrics:

1. **`SwarmDecomposed`** — Emitted in `swarm-orchestrator.ts` when decomposition occurs. Tracks agentId, subTaskCount, depth, and scope.
2. **`ParallelDispatchCompleted`** — Emitted in `task-result-handler.ts` when all tasks complete normally, and in `parallel-barrier-timeout-handler.ts` when a timeout fires. Tracks traceId, taskCount, successCount, overallStatus, and scope.
3. **`BarrierTimeout`** — Already existed in `evolution-metrics.ts`; now complemented by `ParallelDispatchCompleted` for complete coverage.

**Dashboard Utility:** These metrics enable CloudWatch alarms for:
- High decomposition rate (possible abuse)
- Low success rate (agent health issues)
- Frequent barrier timeouts (task sizing or agent capacity problems)

---

## Secondary Fix: Selection Integrity in Swarm Orchestrator

**File:** `core/lib/agent/swarm-orchestrator.ts`

**Issue:** Even with DAG-awareness fixed, the orchestrator could dispatch to disabled agents.

**Fix:** Added an `enabled` check for all sub-task agents before emitting `PARALLEL_TASK_DISPATCH`. If any agent is disabled, the orchestrator falls back to single-task dispatch:

```typescript
const enabledChecks = await Promise.all(
  decomposed.subTasks.map(async (sub) => {
    const config = await AgentRegistry.getAgentConfig(sub.agentId, {
      workspaceId: payload.workspaceId,
    });
    return config?.enabled === true;
  })
);

if (!allEnabled) {
  // Fall back to non-decomposed dispatch
  return { wasDecomposed: false, isPaused, response: responseText };
}
```

---

## Files Modified

| File | Change |
|------|--------|
| `core/lib/agent/swarm-orchestrator.ts` | DAG-aware dependency mapping; selection integrity fallback; `SwarmDecomposed` metric emission |
| `core/lib/metrics/metrics.ts` | Added `swarmDecomposed()` and `parallelDispatchCompleted()` metric factories |
| `core/handlers/agent-runner.ts` | Added pre-flight `AgentRegistry.getAgentConfig` enabled check |
| `core/handlers/events/task-result-handler.ts` | Added `ParallelDispatchCompleted` metric on natural completion |
| `core/handlers/events/parallel-barrier-timeout-handler.ts` | Added `ParallelDispatchCompleted` metric on barrier timeout |

---

## Test Plan

1. **Unit Tests:**
   - `swarm-orchestrator.test.ts` — verify `dependsOn` array is populated correctly from decomposer output
   - `agent-runner.test.ts` — verify disabled agent returns error without executing
   - `metrics.test.ts` — verify new metric datums have correct dimensions

2. **Integration Tests:**
   - Trigger a mission that decomposes into 3+ sub-tasks with dependencies
   - Verify DAG execution order respects dependencies
   - Disable one agent in workspace config; verify fallback to single-task

3. **E2E Tests:**
   - Run `e2e/mission-loop.spec.ts` with swarm missions enabled
   - Verify CloudWatch metrics appear with `SwarmDecomposed` and `ParallelDispatchCompleted`

---

## Sign-off

| Check | Status |
|-------|--------|
| PRINCIPLES.md compliance | ✅ Pass (P13, P14, P15 enforced) |
| ANTI-PATTERNS.md review | ✅ No new anti-patterns introduced |
| Automated tests | ⏳ Pending (run `make test`) |
| Metrics emitted | ✅ SwarmDecomposed, ParallelDispatchCompleted added |
| Backward compatibility | ✅ Preserved (fallback to single-task on disabled agents) |

---

## Recommendations

1. **Auto-scaling:** Consider linking `SwarmDecomposed` metric to Lambda provisioned concurrency auto-scaling for the `agent-runner` function.
2. **Alerting:** Add CloudWatch alarm on `ParallelDispatchCompleted` where `OverallStatus=failed` and `SuccessCount=0` — indicates systemic agent failure.
3. **Future Audit:** Review `parallel-task-completed-handler.ts` for workspace-scoped `AgentRegistry.getAgentConfig` call (line 134 noted in prior audit).
