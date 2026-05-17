# Audit Report: Silo 2 (The Hand) & Perspective B (Evolution Cycle)

**Date**: 2026-05-12
**Auditor**: Antigravity (AI Agent)
**Silos**: Silo 2 (The Hand)
**Perspective**: Perspective B (Evolution Cycle)

## Executive Summary

This audit focused on the **Model Context Protocol (MCP)** infrastructure within Silo 2, evaluating multi-tenant isolation, concurrency safety, and AI readiness. While the core architecture correctly enforces workspace-scoping for caches and connections, a significant **Thundering Herd** race condition was identified in the discovery process. Additionally, several static maps lack TTL or pruning logic, leading to potential memory leaks in long-running processes (Anti-Pattern 19).

## Findings

### 1. [P1] Thundering Herd Race Condition in MCP Discovery
*   **ID**: AUDIT-2026-05-12-HAND-001
*   **File**: `packages/core/lib/mcp/mcp-bridge.ts`
*   **Description**: The `discovering` map check happens at the start of the function, but the `set` call happens much later, after the `discoveryPromise` has been fully defined. This creates a race condition where multiple concurrent requests for the same MCP server will each trigger a full discovery and connection flow before the first one can register itself in the map.
*   **Impact**: Redundant connection attempts, increased latency, and potential resource exhaustion on MCP servers during high-concurrency tool discovery.
*   **Remediation**: Set the promise in the `discovering` map immediately after the initial check.
- **Atomic State Integrity (Principle 13)**: Fixed a bug in `multiplexer.ts` where the global MCP registry was being mutated in-memory during request processing. Now uses a deep-cloned `args` array for tenant-specific overrides.
- **Test Verification**:
  - `packages/core/mcp-servers/multiplexer.test.ts`: Verified multi-tenant isolation and isolation from global state.
  - `packages/core/lib/mcp/mcp-bridge.parallel.test.ts`: Verified thundering herd protection and hub routing context.
  - `scripts/quality/verify-principles.ts`: All core principles passed.

### 2. [P2] Static Map Memory Leak (Anti-Pattern 19)
*   **ID**: AUDIT-2026-05-12-HAND-002
*   **File**: `packages/core/lib/mcp/mcp-bridge.ts`
*   **Description**: Static maps `discovering` and `lastFailures` grow indefinitely. In a multi-tenant environment with thousands of workspaces, these maps will eventually consume significant memory as they store keys like `WS#<workspaceId>#...`.
*   **Impact**: Potential OOM for long-running nodes (SST dev mode or warm Lambdas).
*   **Remediation**: Implement basic TTL-based pruning or size limits for these maps.

### 3. [P1] Hub Routing Context Loss
*   **ID**: AUDIT-2026-05-12-HAND-003
*   **File**: `packages/core/lib/mcp/client-manager.ts`
*   **Description**: `SSEClientTransport` is initialized with only a URL. If the Hub requires tenant context (e.g., `x-workspace-id`) to route to the correct tool set, it is currently missing.
*   **Impact**: Failure to access tenant-specific tools when routing through an MCP Hub.
*   **Remediation**: Pass `workspaceId` as a query parameter or find a way to inject headers into the SSE transport.

### 4. [P2] Redundant Default Server Initialization
*   **ID**: AUDIT-2026-05-12-HAND-004
*   **File**: `packages/core/lib/mcp/mcp-bridge.ts`
*   **Description**: Default MCP servers are initialized atomically using `ConfigManager.atomicUpdateMapEntity`, but the logic still performs a `getRawConfig` call afterwards even if it fails, which might be unnecessary if handled better.
*   **Impact**: Minor performance overhead and cognitive complexity.
*   **Remediation**: Refactor to use the result of the atomic operation more effectively.

## Principles Verification

*   **Principle 11 (Isolation)**: ✅ Core caches and clients are correctly scoped by `workspaceId`.
*   **Principle 13 (Atomic State)**: ✅ Default server initialization uses `attribute_not_exists`.
*   **Anti-Pattern 19 (In-Memory Filtering)**: ⚠️ Static maps in `MCPBridge` and `ConfigManagerBase` lack pruning logic.

## Recommended Actions

1.  Harden `MCPBridge` discovery to prevent thundering herds.
2.  Add a metabolic cleanup task or simple TTL for static maps in Silo 2.
3.  Enhance `SSEClientTransport` to propagate tenant context.
4.  Update `AUDIT-COVERAGE.md` with these findings.
