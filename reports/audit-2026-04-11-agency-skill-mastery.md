# System Audit Report: Agency & Skill Mastery (The Hand)

**Date**: 2026-04-11
**Auditor**: Gemini CLI
**Topic**: The Hand (Agency & Skill Mastery)
**Vertical**: Tool Execution, MCP Integration, and Approval Lifecycle

---

## 🔍 Overview

This audit focused on the boundary between agent intent and tool execution, specifically the "Unified MCP Multiplexer" and the security lifecycle of autonomous actions. The investigation revealed a critical misalignment between the system's core safety principles and its implementation, resulting in potential unauthorized access to protected resources.

---

## 🚩 Findings

### 1. [P0] Critical Default Bug: Autonomous Mode by Default
- **Silo**: The Hand / The Shield
- **Location**: `core/lib/registry.ts` (AgentRegistry.getAgentConfig)
- **Description**: The system defaults `evolutionMode` to `AUTO` (autonomous) if not specified in DynamoDB. However, the internal comments and the **Class C Safety Principle** explicitly state that human-in-the-loop (`HITL`) should be the default for sensitive operations.
- **Evidence**: 
  ```typescript
  // core/lib/registry.ts
  // 2. Resolve evolutionMode (HITL default)
  const { EvolutionMode } = await import('./types/agent');
  config.evolutionMode = config.evolutionMode ?? EvolutionMode.AUTO; // BUG: Should be HITL
  ```
- **Impact**: All backbone agents (SuperClaw, Coder, Planner) operate in `AUTO` mode by default, granting them autonomous permission to modify the system without human approval.

### 2. [P1] Mandatory Approval Bypass in AUTO Mode
- **Silo**: The Hand / The Shield
- **Location**: `core/lib/agent/tool-executor.ts`
- **Description**: When an agent is in `AUTO` mode, the `ToolExecutor` automatically injects `manuallyApproved: true` into the tool arguments. This flag is the primary signal used by security-sensitive tools (like `runShellCommand` or `filesystem_write_file`) to bypass protection gates for critical files (e.g., `.env`, `sst.config.ts`).
- **Impact**: The "Class C" safety gate (Human Approval Required for Infra/Security changes) is effectively non-existent for agents in `AUTO` mode, even though the principles state Class C *always* requires approval.

### 3. [P1] MCP Tool Classification & Permission Gap
- **Silo**: The Hand
- **Location**: `core/lib/mcp/tool-mapper.ts`
- **Description**: Tools discovered via MCP servers are mapped to the internal `ITool` interface with `requiresApproval: false` and `requiredPermissions: []` by default. There is no mechanism to classify these tools into Class A/B/C/D.
- **Impact**: If an MCP server (like `mcp-aws-devops-server`) provides tools for IAM or resource deletion, they will be executed autonomously by any agent with `AUTO` mode enabled, with no secondary approval check.

### 4. [P2] Weak Heuristic Path Detection in shell-command
- **Silo**: The Hand / The Shield
- **Location**: `core/tools/system/fs.ts` (isCommandSafe)
- **Description**: The `runShellCommand` tool uses a loose heuristic to detect paths in a command string: `(part.includes('.') || part.includes('/')) && !part.startsWith('-')`.
- **Impact**: This heuristic can be easily bypassed (e.g., using environment variables, base64 encoding, or simple quoting variations), potentially allowing access to `PROTECTED_FILES`.

---

## 💡 Opportunities for Improvement

1. **Class-Based Tool Registration**: Introduce a mandatory `riskClass` (A, B, C, D) for all tools, including MCP tools.
2. **Hard Approval Gates**: Modify `ToolExecutor` to enforce `requiresApproval` for all Class C and D tools, regardless of the agent's `evolutionMode`.
3. **Dynamic MCP Policy**: Implement a policy-mapping layer for MCP servers that allows administrators to assign permissions and risk classes to specific MCP tools during discovery.
4. **Strict Path Normalization**: Enhance `fs-security.ts` to use real path resolution and normalization before checking against `PROTECTED_FILES`.

---

## 🛠️ Recommended Actions

1. **Immediate (P0)**: Fix the default `evolutionMode` in `AgentRegistry` to `HITL`.
2. **Short-term (P1)**: Update `ToolExecutor` to respect `requiresApproval` even in `AUTO` mode if the tool is marked as high-risk.
3. **Short-term (P1)**: Add a mechanism to `MCPToolMapper` to flag tools matching certain patterns (e.g., `aws_*`, `iam_*`, `*delete*`) as requiring approval.
4. **Medium-term (P2)**: Refactor `isCommandSafe` to use a more robust security scanner or restricted shell environment.
