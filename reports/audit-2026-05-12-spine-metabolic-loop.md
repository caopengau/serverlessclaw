# Audit Report: The Spine & Metabolic Loop

**Date:** 2026-05-12
**Silo Focus:** Silo 1 (The Spine)
**Perspective Focus:** Perspective F (The Metabolic Loop)

## Findings

### 1. [P1] Multi-tenant Leakage in Event DLQ Routing (Anti-Pattern 14 / Anti-Pattern 3)
* **Location:** `packages/core/handlers/events/routing-engine.ts`, `packages/core/handlers/events/task-result-handler.ts`
* **Issue:** When unhandled events or events exceeding the recursion limit were sent to the DLQ via `routeToDlq`, the `workspaceId` and `sessionId` were missing from the arguments. This caused those failed events to lose their multi-tenant context, placing them in the GLOBAL bucket and creating potential telemetry blindness.
* **Resolution:** Updated both handlers to correctly pass `sessionId` and `workspaceId` from the event context to the `routeToDlq` function.

### 2. [P1] Tenant-Blind Config Load for Event Retries (Anti-Pattern 10)
* **Location:** `packages/core/handlers/events.ts`
* **Issue:** The main event handler fetched the `event_max_retry_count` setting from the `ConfigManager` without providing the `workspaceId`. This ignored any workspace-specific retry configurations, defaulting to global configuration.
* **Resolution:** Added `{ workspaceId }` to the `ConfigManager.getTypedConfig` call to respect tenant isolation.

### 3. [P2] Global Configuration Access for Trace Summaries (Anti-Pattern 10)
* **Location:** `packages/core/lib/routing/flow-controller.ts`, `packages/core/lib/tracer/tracer-implementation.ts`
* **Issue:** The `FlowController.areTraceSummariesEnabled()` function did not support `workspaceId` and always fetched the configuration globally. The `tracer-implementation.ts` was using this to determine if a summary should be generated.
* **Resolution:** Refactored `areTraceSummariesEnabled` to accept `workspaceId` and passed `this.workspaceId` from the tracer implementation.

## Verification
- All automated checks passed (`make check`, `make test`, `pnpm principles`).
- Confirmed that `routeToDlq` and `ConfigManager` calls appropriately respect multi-tenancy.
