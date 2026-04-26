# Audit Report: MCP Server Isolation Layer - 2026-04-24

## 🎯 Objective

Verify that Model Context Protocol (MCP) server connections, tool discovery, and execution environments are strictly isolated by tenant (workspace).

## 🎯 Finding Type

- Bug / Multi-tenant Leak / Security Gap

## 🔍 Investigation Path

- **Multiplexer (Silo 2)**: Analyzed `core/lib/mcp/mcp-bridge.ts`.
- **Client Manager (Silo 2)**: Analyzed `core/lib/mcp/client-manager.ts`.
- **Shield (Silo 3)**: Analyzed `CircuitBreaker` usage within the MCP layer.
- **Observed**: Shared tool caches, global client maps, and unisolated circuit breakers.

## 🚨 Findings

| ID  | Title                                     | Type | Severity | Location | Recommended Action |
| :-- | :---------------------------------------- | :--- | :------- | :------- | :----------------- |
| 1   | Shared MCP Tool Discovery Cache (MT Leak) | Bug  | P0       | `mcp-bridge.ts:31` | Include `workspaceId` in the discovery cache key to prevent cross-tenant tool leakage. |
| 2   | Global MCP Client Map (MT Leak)           | Bug  | P0       | `client-manager.ts:24` | Scope the static `clients` map in `MCPClientManager` by `workspaceId` to isolate connections. |
| 3   | Unisolated MCP Circuit Breakers           | Bug  | P1       | `client-manager.ts:86` | Pass `workspaceId` to `getCircuitBreaker` to prevent one tenant's MCP failures from blocking others. |
| 4   | Global MCP Server Configurations          | Bug  | P1       | `mcp-bridge.ts:167` | Use `workspaceId` when fetching `mcp_servers` configuration to allow tenant-specific tools. |
| 5   | Local Environment Variable Leakage        | Leak | P2       | `client-manager.ts:183` | Sanitize `process.env` before passing it to local MCP servers to prevent host secret leakage. |

## 💡 Architectural Reflections

The MCP layer, acting as the system's "Hand," connects the serverless core to external capabilities. However, its implementation is currently "tenant-blind." By sharing discovery caches and active client connections, the system risks a scenario where Tenant A sees tools or uses active connections belonging to Tenant B. 

Furthermore, because circuit breakers are global, a poorly performing MCP server for Tenant A could trigger a system-wide block, effectively performing a Denial of Service on the MCP capabilities of all other tenants.

## 🔗 Related Anti-Patterns

- **Global Thinking**: Tool caches and client maps are static and global.
- **Siloed Fix**: Isolation was added to identity and routing but missed in the external tool interface.
- **Telemetry Blindness**: Connection failures are reported globally rather than per-workspace.
