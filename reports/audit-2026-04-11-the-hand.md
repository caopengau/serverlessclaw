# System Audit: The Hand (Agency & Skill Mastery)
**Date**: 2026-04-11
**Auditor**: Gemini CLI

## Overview
Deep-dive into the "Hand" vertical, focusing on the Unified MCP Multiplexer, Agent-Tool interaction, and the boundary between intent and execution.

## Findings

### P1: Warmup Failure for Multiplexed MCP Servers (FIXED)
*   **Observation**: `WarmupManager.warmMcpServer` was sending a payload to the multiplexer without specifying the server name in the path or headers.
*   **Impact**: Proactive warmup for all MCP servers managed by the multiplexer was failing with a 404, leading to avoidable cold-start latency during the first tool call.
*   **Action**: Fixed in `core/lib/warmup/warmup-manager.ts` and verified with reproduction tests.

### P2: Incomplete MCP Registration Tool
*   **Observation**: The `registerMCPServer` tool (`core/tools/knowledge/mcp.ts`) only supports `local` (command-based) configurations.
*   **Impact**: Agents cannot autonomously register `remote` (SSE) or `managed` (OpenAI Connector) MCP servers, even though the underlying `MCPBridge` supports them.
*   **Recommendation**: Update `registerMCPServer` to support the full `MCPServerConfig` union type.

### P2: Multiplexer Performance & Latency
*   **Observation**: Every tool call through the Lambda multiplexer involves spawning a subprocess (`npx`) and performing a full MCP `initialize` handshake.
*   **Impact**: High latency (p95 > 2s) for tool execution in Lambda environments.
*   **Recommendation**: Explore "Unified Discovery" and "Persistent Handshake Caching" to reduce the overhead of on-demand process spawning.

### P3: Heuristic-based Security and Sensitivity Checks
*   **Observation**: `isSensitiveTool` and `checkArgumentsForSecurity` rely on keyword matching (e.g., "delete", "path").
*   **Impact**: Risk of false positives (blocking safe calls) or false negatives (missing sensitive calls with non-obvious names).
*   **Recommendation**: Augment heuristics with semantic analysis or explicit tool metadata.

### P3: Inconsistent Filesystem Defaults
*   **Observation**: `MCPBridge` and `multiplexer` have slightly different default paths for the filesystem MCP server (`/var/task` vs `.` vs `/tmp`).
*   **Impact**: Confusion about where files are being read/written in Lambda environments.
*   **Recommendation**: Centralize filesystem path resolution in a single utility used by both the bridge and the multiplexer.

## Verification Strategy Used
*   Static code analysis of `core/lib/mcp`, `core/lib/warmup`, and `core/lib/agent/tool-executor.ts`.
*   Reproduction test in `core/lib/warmup/warmup-manager.test.ts` confirming the P1 bug.
*   Verification of the fix through automated test suite.
