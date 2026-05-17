# Audit Report: Silo 3 (Shield) & Silo 6 (Scales) - 2026-05-13

## Audit Details

- **Date**: 2026-05-13
- **Auditor**: Gemini CLI
- **Silos**: 3 (Shield), 6 (Scales)
- **Perspectives**: E (Recovery Path), B (Evolution Cycle)

## Findings Summary

| ID     | Title                                         | Severity | Status | Description                                                                                              |
| :----- | :-------------------------------------------- | :------- | :----- | :------------------------------------------------------------------------------------------------------- |
| **P1** | Multi-tenant leakage in Cognitive Health Tool | High     | FIXED  | `runCognitiveHealthCheck` tool ignored `workspaceId` args, defaulting to global agents.                  |
| **P2** | Multi-tenant leakage in Blast Radius Stats    | Medium   | FIXED  | `SafetyBase.getClassCBlastRadius()` leaked cached stats from other tenants in the same Lambda container. |
| **P2** | In-Memory Anomaly Leakage in Monitor          | Medium   | FIXED  | `CognitiveHealthMonitor` accumulated anomalies from all workspaces in a single instance if reused.       |
| **P2** | Domain Pollution in SafetyEngine              | Medium   | FIXED  | Hardcoded product name "Serverless Claw" in framework core documentation block.                          |

## Detailed Findings & Remediation

### 1. Multi-tenant leakage in Cognitive Health Tool (P1)

**Issue**: The tool `runCognitiveHealthCheck` in `packages/core/tools/system/health.ts` was calling `monitor.takeSnapshot(agentIds)` without passing the `workspaceId` from arguments. This caused it to analyze global agents even when executed within a specific workspace context.
**Remediation**: Updated the tool to extract `workspaceId` from `args` and pass it to `takeSnapshot`.

### 2. Multi-tenant leakage in Blast Radius Stats (P2)

**Issue**: `SafetyBase.getClassCBlastRadius()` returned the entire local cache of blast radius entries. In a multi-tenant environment sharing Lambda containers, this leaked action counts and resource names across tenants.
**Remediation**: Added `workspaceId` parameter to `getClassCBlastRadius` and implemented filtering logic to ensure only relevant scoped entries are returned.

### 3. In-Memory Anomaly Leakage in Monitor (P2)

**Issue**: `CognitiveHealthMonitor` used a single array to track anomalies. When reused across multiple workspace snapshots (as in `handleCognitiveHealthCheck`), it accumulated anomalies from all tenants.
**Remediation**: Refactored `CognitiveHealthMonitor` to store anomalies in a `Map` keyed by `workspaceId`. Updated `getRecentAnomalies` to filter by the requested workspace.

### 4. Domain Pollution (Anti-Pattern 20) (P2)

**Issue**: Hardcoded "Serverless Claw" in `packages/core/lib/safety/safety-engine.ts`.
**Remediation**: Removed the hardcoded name to ensure framework remains product-agnostic.

## Verification Results

- [x] Workspace scoping in `SafetyBase` verified.
- [x] Cognitive Health Monitor isolation verified.
- [x] Tool argument propagation verified.
- [x] Anti-Pattern 20 compliance checked.

## Next Steps

- Monitor `CognitiveHealthMonitor` memory usage for many workspaces in a single container.
- Consider moving `SemanticLoopDetector` history to external cache (Redis/DDB) if session volume exceeds memory limits.
