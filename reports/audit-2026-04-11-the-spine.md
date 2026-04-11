# System Audit: The Spine (Nervous System & Flow)
**Date**: 2026-04-11
**Auditor**: Gemini CLI

## Overview
Audit of the event-driven backbone, focusing on reliability, race conditions, and handoff logic.

## Findings

### P0: Silent Data Loss - Unconsumed Pending Messages
*   **Observation**: `AgentRunner.ts` and `events/shared.ts` (`processEventWithAgent`) both queue tasks into `pendingMessages` via `SessionStateManager.addPendingMessage` when a session lock is held. However, there is no consumer (e.g., in `Maintenance` or after `releaseProcessing`) that ever re-triggers these tasks.
*   **Impact**: Any message sent to a busy session is effectively swallowed by the database and never executed.
*   **Recommendation**: Implement a "Queue Drainer" in `SessionStateManager.releaseProcessing` or a periodic sweep in `Maintenance.handler` to re-emit pending messages as events.

### P0: Reliability Gap - Non-Atomic Idempotency and "Dead Ends"
*   **Observation**: `events.ts` calls `markIdempotent` *before* executing the dynamic handler. If the handler call fails (e.g., due to a Lambda timeout or transient error), subsequent retries from EventBridge will be blocked by the idempotency check.
*   **Impact**: Events can enter a "Dead End" state where they are marked as processed but the work was never completed, and cannot be retried.
*   **Recommendation**: Use `checkAndMarkIdempotent` (which already exists in `idempotency.ts` but is unused in `events.ts`) or ensure the handler is called *before* marking success, or use a multi-state idempotency record (STARTED -> COMPLETED).

### P1: Zombie Locks - Heartbeat vs. Timeout
*   **Observation**: `AgentRunner.ts` starts a 60s heartbeat to renew a 300s lock. If the Lambda is frozen or crashes without the heartbeat running, the lock remains for up to 5 minutes. While this is "safe," it blocks the session for an unnecessarily long time.
*   **Impact**: Reduced system availability during failures.
*   **Recommendation**: Reduce the `LOCK_TTL` and heartbeat interval, or implement a "Force Unlock" capability triggered by the `ConcurrencyMonitor` or `DeadMansSwitch`.

### P2: Inconsistent Recursion Tracking
*   **Observation**: `events.ts` and `AgentRunner.ts` both track and increment recursion depth independently. `events.ts` uses a simple counter in the event detail, while `AgentRunner` uses a dedicated `RecursionTracker` with a stack.
*   **Impact**: Potential for bypass or inconsistent enforcement of limits depending on the entry point.
*   **Recommendation**: Unified recursion tracking utility should be used across all handlers.

## Verification Strategy Used
*   Trace tracking of "Life of a Message" from `webhook.ts` -> `events.ts` -> `AgentRunner.ts`.
*   Code audit of `SessionStateManager` and comparison against available handlers in `core/handlers/events`.
*   Static analysis of idempotency flow in `events.ts`.
