# System Audit Report: The Hand (Agency & Skill Mastery)

**Date**: 2026-04-10
**Silo**: The Hand (Agency & Skill Mastery)
**Auditor**: Gemini CLI
**Perspective**: *How effectively can the system manipulate its environment?*

---

## 🔍 Executive Summary

This deep dive focused on the boundary between agent intent and tool execution, specifically the Unified Model Context Protocol (MCP) integration and the security guardrails surrounding tool usage. While the architecture for MCP tool discovery and execution is robust and parallelized, significant gaps were identified in the **Security Enforcement** and **Human-in-the-Loop (HITL) approval lifecycle**.

The most critical finding (**P0**) is a bypass in the file security layer that allows an autonomous agent to self-approve modifications to protected system files.

---

## 🚩 Findings

### 1. Self-Approval Security Bypass
- **Severity**: **P0** (Security Vulnerability)
- **Status**: Identified
- **Description**: The `fs-security.ts` utility allows modifications to protected paths (e.g., `sst.config.ts`, `.env`) if the argument `manuallyApproved: true` is present. However, this argument is set by the LLM itself. `ToolExecutor.ts` does not verify if this "manual approval" actually originated from a human via the system's approval mechanism.
- **Evidence**: `core/lib/utils/fs-security.ts` checks `args.manuallyApproved` directly. An LLM can simply include this parameter in its tool call to bypass the block.

### 2. HITL Approval ID Mismatch
- **Severity**: **P1** (Reliability / Functional Bug)
- **Status**: Identified
- **Description**: The system handles high-risk tool approvals by matching `toolCall.id`. Since real LLM providers (OpenAI, Anthropic, Gemini) generate unique, non-deterministic IDs for tool calls in every turn, the `approvedToolCalls` list passed from the dashboard will never match the new IDs generated when the agent "retries" the call after approval.
- **Evidence**: `ToolExecutor.ts` line 144: `if (tool.requiresApproval && !approvedToolCalls?.includes(toolCall.id))`.

### 3. Safety Engine Bypassed in Execution
- **Severity**: **P2** (Architectural Debt)
- **Status**: Identified
- **Description**: `SuperClaw` implements a sophisticated `SafetyEngine` with granular policies, but the `AgentExecutor` and `ToolExecutor` are decoupled from this instance. They rely on static `requiresApproval` flags defined in tool schemas rather than the dynamic `requiresApproval()` method on the agent.
- **Evidence**: `Agent.ts` creates a generic `AgentExecutor` that only receives a list of tools, losing access to the `SuperClaw` instance's safety logic.

### 4. Lambda Filesystem Restrictiveness
- **Severity**: **P2** (Operational Limitation)
- **Status**: Identified
- **Description**: In Lambda environments, the MCP `filesystem` server is hardcoded to use `/tmp`. This prevents the agent from accessing the actual project workspace or persistent mounts (like EFS) that might be required for autonomous evolution.
- **Evidence**: `core/lib/mcp.ts` lines 275-278.

### 5. Discovery Lock Weakness
- **Severity**: **P3** (Observation)
- **Status**: Identified
- **Description**: `MCPBridge` uses a random 7-character string as `ownerId` for its distributed lock. While functional, it lacks traceability compared to using the Lambda Request ID or a more deterministic node identifier.
- **Evidence**: `core/lib/mcp.ts` line 52.

---

## 🛠️ Recommended Actions

1.  **Immediate (P0)**: Update `ToolExecutor.ts` to only honor `manuallyApproved: true` if the `toolCall.id` (or a semantic hash of the call) exists in the `approvedToolCalls` array provided by the user.
2.  **Short-term (P1)**: Refactor the approval mechanism to use **Semantic Tool Fingerprinting** (e.g., `hash(toolName + arguments)`) to match approvals across turns, bypassing the volatility of provider-generated IDs.
3.  **Short-term (P2)**: Integrate the `SafetyEngine` into the core execution loop. `AgentExecutor` should call `agent.evaluateAction()` before any tool execution to allow for dynamic, context-aware safety checks.
4.  **Short-term (P2)**: Update `MCPBridge` to make the filesystem base path configurable via `PROCESS_CWD` or a similar environment variable instead of hardcoding `/tmp`.

---

## 🧪 Verification Strategy

- **Reproduction Script**: Create a test case where a mock agent attempts to write to `sst.config.ts` with `manuallyApproved: true` and verify it succeeds (confirming the bug).
- **Integration Test**: Update `executor.test.ts` to simulate a multi-turn approval flow with changing tool IDs to verify the failure and subsequent fix.
