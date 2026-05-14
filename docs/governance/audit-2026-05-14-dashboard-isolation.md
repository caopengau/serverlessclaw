# Audit Report: Dashboard Multi-Tenant Isolation (2026-05-14)

## Status: REMEDIATED ✅

## Overview
This audit focused on the `apps/dashboard` API routes, specifically looking for violations of **Principle 11 (Multi-tenant Isolation)** and **Anti-Pattern 14 (Global Telemetry/Missing WorkspaceId)** and **Anti-Pattern 19 (In-Memory Multi-Tenant Isolation Breach)**.

## Findings

### P1: Global Trace Deletion Breach (`apps/dashboard/src/app/api/trace/route.ts`)
- **Issue**: The `DELETE /api/trace?traceId=all` endpoint performed a global scan and deletion of all traces in the `TraceTable` without any workspace scoping or permission checks.
- **Risk**: A single user could wipe out traces for the entire system (all tenants).
- **Remediation**: Added `workspaceId` scoping to the `ScanCommand` and `QueryCommand`. Implemented permission checks via `IdentityManager.hasPermission(Permission.AGENT_DELETE)`.

### P1: Multi-Tenant Data Leakage in Analytics & Metrics
- **Affected Routes**:
  - `apps/dashboard/src/app/api/resilience/metrics/route.ts`
  - `apps/dashboard/src/app/api/cognitive-health/route.ts`
  - `apps/dashboard/src/app/api/analytics/route.ts`
  - `apps/dashboard/src/app/api/collaboration/route.ts`
  - `apps/dashboard/src/app/api/consensus/route.ts`
  - `apps/dashboard/src/app/api/reputation/route.ts`
  - `apps/dashboard/src/app/api/system/burn-rate/route.ts`
  - `apps/dashboard/src/app/api/budget/route.ts`
  - `apps/dashboard/src/app/api/locks/route.ts`
- **Issue**: These routes used global prefixes (e.g., `HEALTH#`, `CONSENSUS#`, `PARALLEL#`) with `listByPrefix` or `ScanCommand`, retrieving data from all tenants and returning aggregated or raw results to any caller.
- **Risk**: Significant data exposure between tenants. Any authenticated user could see health, performance, budget, and collaboration data of any other tenant.
- **Remediation**: 
  - Implemented `workspaceId` extraction from headers/query params.
  - Added mandatory permission checks (`Permission.AGENT_VIEW`) for all GET requests.
  - Switched to scoped prefixes (`WS#${workspaceId}#...`) for all memory and config lookups.
  - Added `FilterExpression` for `workspaceId` in `ScanCommand` calls.

### P2: Dashboard Authorization Gaps
- **Issue**: Several routes lacked any `getUserId` or permission checks, assuming that presence in the dashboard was sufficient.
- **Remediation**: Integrated `getUserId` and `IdentityManager` into all affected routes.

## Verification
- Verified code changes for all 10+ affected routes.
- Confirmed that `ParallelAggregator` and `LockManager` correctly support the `WS#${workspaceId}#` prefix.
- Confirmed that `TokenTracker.getRollupRange` correctly handles `workspaceId` scope.

## Coverage Update
- **Silos**: Eye (5), Spine (1), Brain (4)
- **Perspectives**: D (Trust Loop), G (Dashboard Integrity - NEW)
- **Status**: Hardened dashboard APIs against multi-tenant leaks.

---
**Auditor**: Gemini CLI (Auto-Edit Mode)
**Date**: 2026-05-14
