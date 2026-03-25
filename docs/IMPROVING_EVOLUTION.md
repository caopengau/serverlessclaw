# Improving Self-Evolution: Safe Releases & Hardened Trunk Syncing

This document outlines the improvements to the Serverless Claw self-evolution stack to ensure safer releases and robust synchronization with the trunk (`main` branch) in a trunk-based development environment.

## Current State Analysis

The current evolution loop is:
1. **Reflector** identifies a gap.
2. **Strategic Planner** designs a plan.
3. **Coder Agent** implements changes locally.
4. **`STAGE_CHANGES`** tool uploads a ZIP of modified files to S3.
5. **`TRIGGER_DEPLOYMENT`** tool starts AWS CodeBuild.
6. **CodeBuild** applies the ZIP, deploys via SST, and pushes directly to `main`.
7. **QA Auditor** verifies the live environment.

### Identified Weaknesses
* **Direct Push to `main` before QA**: Bypasses the final quality gate.
* **Non-Atomic Sync**: Changes are pushed to Git before the QA Auditor has verified them.
* **Weak Pre-flight Checks**: Verification tools were previously optional for the Coder Agent.
* **Missing Tests/Docs**: Logic changes could land in the trunk without associated tests or documentation.

---

## Hardened Improvements (March 2026)

### 1. Hardened Pre-Flight Gate (DoD Enforcement)
The **`STAGE_CHANGES`** tool now enforces a strict **Definition of Done (DoD)**:
- **Mandatory Validation**: It verifies that `validateCode` and `runTests` have successfully passed in the current session history.
- **Completeness Check**: It scans for logic changes in `core/` or `infra/` and requires:
    - At least one new or modified `.test.ts` file.
    - At least one documentation update (in `docs/`, `README.md`, or `INDEX.md`).
- **Mechanical Block**: If the DoD is not met, the staging is blocked, preventing any AWS CodeBuild costs.

### 2. Post-QA Atomic Sync (`GIT_SYNC` Tool)
The system now separates the deployment from the repository synchronization.
- **Step 1: Deployment**: CodeBuild deploys the changes to the live environment but does **not** push to Git.
- **Step 2: Verification**: The **QA Auditor** verifies the live deployment satisfy the gap.
- **Step 3: Final Sync**: Only after verification passes, the `QA Auditor` (or the `Initiator`) calls the **`gitSync`** tool.
- **Step 4: Atomic Commit**: `gitSync` triggers a special CodeBuild job with `SYNC_ONLY=true` that pulls, rebases (if needed), and pushes the verified code back to the remote `main` branch.

### 3. Initiator-First Failure Loop
If the QA Auditor identifies a failure:
- It **notifies the original Initiator** (SuperClaw or Strategic Planner).
- The Initiator analyzes the Audit Report against the original goal.
- The Initiator decides whether to:
    - **Retry**: Re-dispatch the Coder with refined instructions.
    - **Pivot**: Assign the task to a different agent.
    - **Escalate**: Ask the human user for guidance if the failure is fundamental.

---

## Safety Benefits
* **Peer Review Readiness**: All changes in the trunk are now guaranteed to be tested and documented.
* **Audit Trail**: Every autonomous evolution step is recorded with a technical audit report.
* **Reversibility**: Since the push is delayed until after QA, the trunk remains clean even if a deployment is initially buggy.
* **Strategic Oversight**: High-level agents (SuperClaw/Planner) manage the failure loop, preventing "infinite loop" failures between Coder and QA.
