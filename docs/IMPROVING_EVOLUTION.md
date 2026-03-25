# Improving Self-Evolution: Safe Releases & Repository Syncing

This document outlines the proposed improvements to the Serverless Claw self-evolution stack to ensure safer releases and robust synchronization with the code repository.

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
* **Direct Push to `main`**: Bypasses code review and standard branch protection.
* **Non-Atomic Sync**: Changes are pushed to Git before the QA Auditor has verified them.
* **Potential for Conflicts**: Parallel agent tasks can conflict when pushing to `main`.
* **Weak Pre-flight Checks**: Verification tools are optional for the Coder Agent.

---

## Proposed Improvements

### 1. Branch-Based Sync Flow (Pull Requests)
Instead of pushing directly to `main`, the system will transition to a **Pull Request (PR) workflow**.

**New Flow**:
1. CodeBuild pushes changes to a dedicated branch: `evolution/gap-<id>-build-<number>`.
2. A new `github` tool (or CLI command in CodeBuild) opens a Pull Request on GitHub.
3. The PR includes:
   - Link to the Evolution Gap in the Dashboard.
   - Summary of changes.
   - Test results from the build.

### 2. Hardened Quality Gates
* **Coder Requirement**: The Coder Agent **must** run `VALIDATE_CODE` and `RUN_TESTS` before it is permitted to call `STAGE_CHANGES`.
* **CodeBuild Failure**: If `make test-tier-3` (E2E tests) fails, the branch push and PR creation are aborted.

### 3. Integrated QA & Merge Logic
The **QA Auditor** becomes the final gate for both the live environment and the repository:
* **Manual Mode (HITL)**: QA Auditor verifies the live deployment and then asks the user to review and merge the GitHub PR.
* **Auto Mode**: Once QA Auditor verifies the deployment satisfies the gap, it calls a `MERGE_PULL_REQUEST` tool to merge the code into `main`.

---

## Implementation Roadmap

### Phase 1: GitHub Tooling (Short Term)
- [ ] Add `core/tools/github.ts` with `CREATE_PULL_REQUEST` and `MERGE_PULL_REQUEST` tools.
- [ ] Update `infra/deployer.ts` to ensure `GITHUB_TOKEN` has `pull_requests:write` permissions.

### Phase 2: CodeBuild Refactor (Short Term)
- [ ] Modify `buildspec.yml` to:
  - Detect the `GAP_ID` (if available).
  - Push to `evolution/gap-$GAP_ID`.
  - Open a PR using the new tool or a simple `curl` command to GitHub API.

### Phase 3: Agent Orchestration (Medium Term)
- [ ] Update **Coder Agent** prompt to enforce pre-deployment validation.
- [ ] Update **QA Auditor** to handle PR status updates (e.g., adding a comment with the audit report).

### Phase 4: Local Sync (Medium Term)
- [ ] Add a `PULL_LATEST_REPO` tool to ensure agents always start from the current `main` branch state, even if they are running in a long-lived environment.

---

## Safety Benefits
* **Peer Review**: Human developers can see exactly what the agent changed before it hits `main`.
* **Audit Trail**: Every autonomous evolution step is recorded as a PR with associated comments and test results.
* **Reversibility**: Standard Git `revert` can be used on the PR merge if issues are discovered later.
