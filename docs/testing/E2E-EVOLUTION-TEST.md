# End-to-End Evolution Cycle Test Instructions

> **For Agents**: Follow this guide to verify the complete self-evolution lifecycle of Serverless Claw. This test ensures that the system can identify a weakness, implement a fix, deploy it, and verify success.

## 🎯 Test Objective

Trigger a "Strategic Gap," observe the autonomous resolution, and verify the resulting code and deployment status.

## 🛠 Prerequisites

- Ensure `TRUNK_SYNC_ENABLED=true` in the CodeBuild environment.
- Ensure the agent has `SafetyTier.PROD` or `EvolutionMode.AUTO` if running without human intervention.
- Workspace is clean and up to date.

## 🏃 Step-by-Step Test Procedure

### 1. Trigger a Strategic Gap

Interact with the system (e.g., via the Chat API or Dashboard) and express a need for a capability that is intentionally missing or needs improvement.

- **Example Prompt**: "I wish I had a tool to generate a summary of all recent audit reports in a single Markdown table. Currently, I have to read them one by one."

### 2. Verify Gap Detection (Cognition Reflector)

Check the `MemoryTable` or the **Pipeline** page in the Dashboard.

- **Expectation**: A new `strategic_gap` should appear with status `OPEN`.
- **Tool to use**: `tools.knowledge_searchInsights` with query `type: STRATEGIC_GAP`.

### 3. Observe Planning (Strategic Planner)

Wait for the Planner to pick up the gap (typically every 48 hours, or you can trigger it manually by emitting a `PULSE_HEALTH` event).

- **Expectation**: Gap status transitions to `PLANNED`. A `STRATEGIC_PLAN` is attached to the gap.

### 4. Observe Implementation (Coder Agent)

Once the plan is approved (or auto-approved in `AUTO` mode), the Coder agent is dispatched.

- **Expectation**:
  - Gap status transitions to `PROGRESS`.
  - Coder creates a new tool or modifies existing code.
  - Coder runs `verifyChanges` (DoD).
  - Coder calls `triggerDeployment`.

### 5. Verify Build & Deployment (Build Monitor)

Observe the AWS CodeBuild project execution.

- **Expectation**:
  - Build succeeds.
  - `BuildMonitor` detects success.
  - Gap status transitions to `DEPLOYED`.
  - Code is pushed back to the `main` branch.

### 6. Final Verification (QA Auditor)

The QA agent is dispatched to verify the new capability.

- **Expectation**:
  - QA verifies the tool works as described in the spec.
  - Gap status transitions to `DONE`.

## 🚨 Troubleshooting "Bad Loops"

If the agent gets stuck:

1. **Check Circuit Breakers**: `tools.system_getCircuitBreaker` - is it `OPEN`?
2. **Check Attempt Counts**: `tools.knowledge_getGap` - has it reached 3 attempts?
3. **Check Logs**: Inspect the trace for `REOPEN` signals from the QA agent.

## ✅ Definition of Success

A test is successful if a user-expressed need results in a **merged commit** on `main` and a `DONE` status for the corresponding gap without human engineering intervention.
