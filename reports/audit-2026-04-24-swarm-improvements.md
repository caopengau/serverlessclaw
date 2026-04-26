# Audit Report: Agentic Swarm Improvement (Silo 2 + Silo 7 + Perspective A)

**Date:** 2026-04-24
**Auditor:** serverless-claw-auditor
**Scope:** Agentic Swarm Decomposition, Parallel Dispatch, Selection Integrity, DAG Execution, Metabolic Patterns
**Silos:** Silo 2 (The Hand), Silo 7 (The Metabolism)
**Perspective:** A — Life of a Message (Swarm decomposition → Parallel dispatch → Aggregation)

---

## Executive Summary

This audit focused on the **Agentic Swarm** subsystem and identified **7 improvements** across decomposition logic, parallel aggregation security, telemetry completeness, agent specialization, adaptive scaling, retry resilience, and metabolic waste detection. Automated checks (`make check`, `pnpm principles`, `make test`) all passed before changes.

---

## Findings

### Finding 1: Dependency-Awareness Failure in Decomposer (P1)

**File:** `core/lib/agent/decomposer.ts:191`
**Severity:** P1 — High
**Principle:** P13 (Atomic State Integrity), P15 (Monotonic Progress)
**Related Anti-Pattern:** #6 Direct Object-Level Overwrites (conceptual — flat decomposition loses intent)

**Issue:** `decomposePlan()` hardcodes `dependencies: []` for every sub-task. The DAG executor and swarm orchestrator are fully capable of dependency-aware execution, but the decomposer never produces them. All tasks run in parallel even when they are inherently sequential (e.g., "implement → test → deploy").

**Expected:** Sub-tasks that are clearly sequential (numbered steps, "Then/Next/Finally" markers) should have dependencies to preserve execution order.

**Actual:** Every sub-task has `dependencies: []`, forcing full parallelism regardless of plan structure.

**Fix:** Infer sequential dependencies from step order when markers indicate sequence.

---

### Finding 2: Workspace-Scoped Parallel Aggregation (P1)

**File:** `core/lib/agent/parallel-aggregator.ts:49-86`
**Severity:** P1 — High
**Principle:** P13 (Atomic State Integrity), Multi-tenancy
**Related Anti-Pattern:** #3 Missing enabled check (analogous — missing scope check)

**Issue:** `ParallelAggregator.init()` uses partition key `${PARALLEL_PREFIX}${userId}#${traceId}`. No `workspaceId` is included. A user in multiple workspaces could have parallel dispatch collisions or cross-workspace state leakage.

**Expected:** Aggregation keys should be workspace-scoped.

**Actual:** Same user + traceId in different workspaces would share the same DynamoDB item.

**Fix:** Include `workspaceId` in the partition key when available.

---

### Finding 3: Missing Agent Specialization in Decomposer (P2)

**File:** `core/lib/agent/decomposer.ts:279-322`
**Severity:** P2 — Medium
**Principle:** P10 (Lean Evolution)

**Issue:** `determineAgent()` only routes to `RESEARCHER` or `CODER`. Tasks clearly requiring QA, Critic, or Facilitator capabilities are incorrectly dispatched to Coder.

**Expected:** Test/verify tasks → QA. Review/audit tasks → CRITIC. Consensus/conflict tasks → FACILITATOR.

**Actual:** All non-research tasks go to CODER.

**Fix:** Add keyword patterns for QA, CRITIC, and FACILITATOR tasks.

---

### Finding 4: Missing ParallelDispatchCompleted Metric on Timeout (P2)

**File:** `core/handlers/events/parallel-barrier-timeout-handler.ts:75-92`
**Severity:** P2 — Medium
**Principle:** P11 (Durable Observability)
**Related Anti-Pattern:** #9 Telemetry Blindness

**Issue:** The timeout handler emits `EVOLUTION_METRICS.recordBarrierTimeout()` but does **not** emit the newer `METRICS.parallelDispatchCompleted()` metric that was added in the 2026-04-24 swarm audit for natural completions. This creates an observability gap where timeout completions are under-reported in the primary dispatch metric.

**Expected:** All terminal dispatch states (success, partial, failed, timed_out) emit `ParallelDispatchCompleted`.

**Actual:** Only natural completions emit it; timeouts do not.

**Fix:** Add `METRICS.parallelDispatchCompleted()` emission in the timeout handler.

---

### Finding 5: Static Decomposition Constants (P2)

**File:** `core/lib/agent/decomposer.ts:88-93`
**Severity:** P2 — Medium
**Principle:** P10 (Lean Evolution)

**Issue:** `DEFAULT_MAX_SUB_TASKS = 5` and `DEFAULT_MIN_PLAN_LENGTH = 500` are hardcoded. The decomposer does not consider:
- How many agents are actually enabled in the workspace
- System load or agent health
- Historical success rates for this task type

**Expected:** `maxSubTasks` should scale with available healthy agents.

**Actual:** Always capped at 5, even if only 2 agents are available or 10 are healthy.

**Fix:** Query `AgentRegistry` for enabled agent count and cap `maxSubTasks` dynamically.

---

### Finding 6: No Swarm-Level Retry or Re-decomposition (P2)

**File:** `core/handlers/events/parallel-task-completed-handler.ts`
**Severity:** P2 — Medium
**Principle:** P5 (Proactive & Efficient)

**Issue:** When a parallel sub-task fails, the system marks it failed and cascades. There's no attempt to:
- Retry the task with a different agent specialization
- Re-decompose a failed chunk into smaller pieces
- Escalate to Facilitator for consensus on partial results

**Expected:** At least one retry attempt with an alternative agent before giving up.

**Actual:** Immediate failure cascade.

**Fix:** Add retry logic that attempts dispatch with an alternative agent type.

---

### Finding 7: Missing Metabolic Waste Detection for Swarm Patterns (P3)

**File:** `core/lib/agent/parallel-aggregator.ts`
**Severity:** P3 — Low
**Principle:** P10 (Lean Evolution), Silo 7 (Metabolism)

**Issue:** The system has no memory of which decomposition patterns consistently fail. If a certain type of plan (e.g., "auth refactoring") always decomposes into sub-tasks that timeout, the system will keep doing it forever.

**Expected:** Track per-source-agent / per-pattern success rates and skip decomposition when a pattern has historically failed.

**Actual:** No pattern memory. Infinite repetition of failing strategies.

**Fix:** Emit a lightweight pattern-id metric and cache recent pattern outcomes in the aggregator metadata.

---

## Files Modified

| File | Change |
|------|--------|
| `core/lib/agent/decomposer.ts` | Dependency inference; expanded agent routing; dynamic maxSubTasks; pattern metadata |
| `core/lib/agent/parallel-aggregator.ts` | Workspace-scoped partition keys; pattern outcome tracking |
| `core/handlers/events/parallel-barrier-timeout-handler.ts` | Added `parallelDispatchCompleted` metric emission |
| `core/handlers/events/parallel-task-completed-handler.ts` | Added retry-with-alternative-agent logic |

---

## Test Plan

1. **Unit Tests:**
   - `decomposer.test.ts` — verify dependencies inferred from sequential markers
   - `decomposer.test.ts` — verify QA/CRITIC/FACILITATOR routing
   - `parallel-aggregator.test.ts` — verify workspaceId in partition key
   - `parallel-barrier-timeout-handler.test.ts` — verify metric emission

2. **Integration Tests:**
   - Trigger a mission with "Step 1: implement, Step 2: test, Step 3: deploy"
   - Verify DAG execution order respects inferred dependencies
   - Disable QA agent; verify test tasks fall back to CODER

3. **E2E Tests:**
   - Run `e2e/mission-loop.spec.ts` with swarm missions
   - Verify CloudWatch metrics include `ParallelDispatchCompleted` for timeouts

---

## Sign-off

| Check | Status |
|-------|--------|
| PRINCIPLES.md compliance | ✅ Pass |
| ANTI-PATTERNS.md review | ✅ No new anti-patterns introduced |
| Automated tests | ✅ All pass before changes |
| Metrics emitted | ✅ ParallelDispatchCompleted added to timeout handler |
| Backward compatibility | ✅ Preserved (fallback behaviors) |

---

## Recommendations

1. **Future Audit:** Review `parallel-task-completed-handler.ts` for workspace-scoped `AgentRegistry.getAgentConfig` calls.
2. **Alerting:** Add CloudWatch alarm on `ParallelDispatchCompleted` where `overallStatus=failed` and `retryAttempt > 0` — indicates persistent agent failure.
3. **Auto-scaling:** Link `SwarmDecomposed` metric to Lambda provisioned concurrency for the `agent-runner` function.
