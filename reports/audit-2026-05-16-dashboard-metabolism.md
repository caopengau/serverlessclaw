# Audit Report: Dashboard Integrity & Metabolic Loop - 2026-05-16

## 🎯 Objective

Another round of audit and remediation on the Serverless Claw system, focusing on Dashboard Integrity (Perspective G) and Metabolic Loop (Perspective F), with a specific lens on multi-tenant isolation and Anti-Pattern 19 (In-Memory/Scan Filtering).

## 🎯 Finding Type

- Bug / Gap / Inconsistency / Refactor

## 🔍 Investigation Path

- Started at: `docs/governance/AUDIT-COVERAGE.md` and `AUDIT-INSTRUCTIONS.md`
- Followed: `apps/dashboard/src/app/api`, `apps/dashboard/src/app/(dashboard)`, and `packages/core/handlers/maintenance.ts`
- Observed:
    - `TracePage` in the dashboard uses `ScanCommand` for session titles, a violation of Principle 11 and Anti-Pattern 19.
    - `TraceAPI` purge uses `ScanCommand` instead of the available `WorkspaceSummaryIndex` GSI.
    - `MaintenanceHandler` performs global stale collaboration discovery outside the workspace loop, violating Metabolic Isolation (Anti-Pattern 22).
    - `TracePage` lacks explicit permission checks for `workspaceId` in the Server Component, potentially allowing cross-tenant data viewing if `workspaceId` is omitted.

## 🚨 Findings

| ID  | Title                                           | Type | Severity | Location                                      | Recommended Action                                                                 |
| :-- | :---------------------------------------------- | :--- | :------- | :-------------------------------------------- | :--------------------------------------------------------------------------------- |
| 1   | Multi-tenant Leak in Trace Page (Dashboard)     | Bug  | P0       | `apps/dashboard/src/app/(dashboard)/trace/page.tsx` | Enforce workspace permission check and default to a safe workspace.                |
| 2   | Anti-Pattern 19 (Scan) in Session Title Fetch   | Bug  | P1       | `apps/dashboard/src/app/(dashboard)/trace/page.tsx` | Use `WorkspaceTypeIndex` or `TypeTimestampIndex` instead of `ScanCommand`.          |
| 3   | Anti-Pattern 19 (Scan) in Trace Purge API       | Bug  | P1       | `apps/dashboard/src/app/api/trace/route.ts`   | Use `WorkspaceSummaryIndex` GSI for purging all traces of a workspace.             |
| 4   | Metabolic Blindness in Stale Collab Discovery   | Bug  | P1       | `packages/core/handlers/maintenance.ts`        | Move `findStaleCollaborations` into the workspace loop to ensure tenant isolation. |
| 5   | Missing workspaceId in Tie-Break Event          | Bug  | P2       | `packages/core/handlers/maintenance.ts`        | Pass `workspaceId` from the collaboration object to the `STRATEGIC_TIE_BREAK` event. |

## 💡 Architectural Reflections

The system has GSIs designed for multi-tenant isolation (`WorkspaceSummaryIndex`, `WorkspaceTypeIndex`), but they are not always utilized in the dashboard and maintenance handlers. Continued enforcement of Principle 11 (Isolation) is required as the dashboard surface grows.
