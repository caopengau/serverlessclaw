# Audit Report: The Hand & Metabolism

**Date**: 2026-05-13
**Silos**: 2 (The Hand), 7 (The Metabolism)
**Perspective**: B (Evolution Cycle), F (Metabolic Loop)

## Focus Areas

- Multi-tenant leakage in MCP Bridge Connections
- Domain Pollution in Automated Synchronization
- Verification of Principle 11 (Isolation) & Principle 13 (Atomic Updates)

## Findings & Remediation

1. **[P1] Missing Multi-Tenant Scoping in MCP Bridge Audit**
   - **Location**: `packages/core/lib/maintenance/metabolism/audit.ts`
   - **Issue**: The `runMcpAudit` method retrieved AST tools using `MCPBridge.getToolsFromServer('ast', '')` without passing the `workspaceId`. This caused MCP tool requests to run in the `global` scope, bypassing multi-tenant isolation and polluting the global MCP cache.
   - **Fix**: Added `{ workspaceId: scope.workspaceId }` to the options object in `getToolsFromServer` to correctly scope the MCP connection to the tenant.

2. **[P1] Ambiguous Scoping in Recovery Circuit Breaker**
   - **Location**: `packages/core/handlers/recovery.ts`
   - **Issue**: `getCircuitBreaker('system_health')` was called without a workspace ID. While the "Dead Man's Switch" checks the whole system, the failure to pass explicit scoping bypasses static checks and leaves the fallback scope ambiguous.
   - **Fix**: Explicitly scoped the circuit breaker instantiation to `'global'` via `getCircuitBreaker('system_health', 'global')`, resolving the check violation and clarifying intent.

3. **[P2] Domain Pollution in Framework Code (Anti-Pattern 20)**
   - **Location**: `packages/core/handlers/sync-webhook.ts` and `packages/core/lib/sync/orchestrator.ts`
   - **Issue**: Hardcoded product strings (e.g. "Automated by ServerlessClaw Issue-Driven Sync") violated domain pollution rules for framework code.
   - **Fix**: Replaced hardcoded "ServerlessClaw" references with dynamic variables like `${process.env.SST_APP || 'Framework'}`.

4. **[Verified] Tool Security & Atomic Updates**
   - Verified that `executeRepairs` (Silo 7) properly utilizes atomic DDB conditions (`AgentRegistry.disableAgentIfTrustLow` using `atomicUpdateMapEntity`) without race conditions.
   - Verified that MCP connections and cached definitions properly incorporate `workspaceId` prefixing in `client-manager.ts`.

## Next Steps

- Verify the successful compilation and execution of native and MCP-based autonomous audits to ensure tools are correctly fetched within the workspace scope.
