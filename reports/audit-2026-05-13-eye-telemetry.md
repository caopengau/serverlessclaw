# Audit Report: The Eye (Telemetry & Metrics)

**Date**: 2026-05-13
**Silo**: 5 (The Eye)
**Perspective**: D (Trust Loop / Telemetry)

## Focus Areas

- Multi-tenant leakage (Missing workspaceId scoping)
- Telemetry Blindness (Missing or unscoped metrics)
- Race conditions in Lock/Session management
- In-Memory Multi-Tenant Filtering (Anti-Pattern 19)
- Domain Pollution (Anti-Pattern 20)

## Findings & Remediation

1. **[P1] Anti-Pattern 19: In-Memory Multi-Tenant Filtering in `analyzeMemoryHealth`**
   - **Location**: `packages/core/lib/metrics/cognitive/analyzer.ts`
   - **Issue**: `analyzeMemoryHealth` was scanning memory items across ALL workspaces (`scanByPrefix('WS#')`) up to a limit, then filtering the results in memory. This led to cross-tenant memory health data leakage.
   - **Fix**: Added `workspaceId` parameter and updated the DynamoDB query to scope the scan prefix to the provided workspace ID (`WS#${workspaceId}#${prefix}`), performing server-side filtering.

2. **[P1] Missing Multi-Tenant Scoping in `CognitiveHealthMonitor`**
   - **Location**: `packages/core/lib/metrics/cognitive/monitor.ts`
   - **Issue**: The `takeSnapshot` method accepted a `workspaceId` but failed to pass it down to `this.analyzer.analyzeMemoryHealth()`, inadvertently performing global health aggregations even for workspace-scoped snapshots.
   - **Fix**: Passed `workspaceId` to `analyzeMemoryHealth(workspaceId)` to ensure proper scoping.

3. **[P2] Domain Pollution in CloudWatch Metrics**
   - **Location**: `packages/core/lib/metrics/metrics.ts`
   - **Issue**: The CloudWatch metrics namespace was hardcoded to `'ServerlessClaw'`, violating Anti-Pattern 20 (Domain Pollution) which mandates framework code to be product-agnostic.
   - **Fix**: Updated the namespace to dynamically resolve using `process.env.SST_APP || 'ServerlessClaw'`.

4. **[Verified] Lock/Session Management Integrities**
   - **Location**: `packages/core/lib/lock/lock-manager.ts` and `packages/core/lib/session/session-state.ts`
   - **Observation**: Checked for race conditions in LockManager release and Session release. Conditional Expressions correctly included checks for `ownerId` and `processingAgentId` (Principle 13). Compliant.

## Next Steps

- Verify the impact of the updated telemetry scoping by confirming that Dashboard metrics and logs do not display cross-tenant cognitive anomalies.
