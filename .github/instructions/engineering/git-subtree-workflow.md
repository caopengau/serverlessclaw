# Git Subtree Workflow: Hub-and-Spoke

This document defines the bidirectional synchronization workflow between the **VoltX Hub** and the **ServerlessClaw Framework**.

## 1. Architectural Model

The relationship follows a "Local-First Hub-and-Spoke" pattern. VoltX consumes the framework as a subtree while contributing generic improvements back.

```text
  ┌─────────────────────────────────┐
  │ serverlessclaw (Remote Origin)  │ ◄─── (github.com/serverlessclaw/serverlessclaw)
  └────────────────┬────────────────┘
                   │
                   │ git fetch / pull / push
                   ▼
  ┌─────────────────────────────────┐
  │ serverlessclaw (Local Source)   │ ◄─── (/Users/pengcao/projects/serverlessclaw)
  └────────────────┬────────────────┘
                   │
                   │ git subtree pull / push
                   │ (upstream remote in VoltX)
                   ▼
  ┌─────────────────────────────────┐
  │           VoltX Hub             │ ◄─── (Current Workspace)
  │      (./framework/ prefix)      │
  └─────────────────────────────────┘
```

## 2. Agent Workflow Instructions

### A. Syncing Downstream (Updating Framework)

Use this when new features or fixes are available in the framework.

1.  **Update Local Source:** Go to `/Users/pengcao/projects/serverlessclaw` and run `git pull origin main`.
2.  **Pull into Hub:** In the VoltX root, run `make pull`.
    - This executes: `git subtree pull --prefix=framework upstream main --squash`.
    - **Agent Tip:** Ensure your worktree is clean before pulling.

### B. Promoting Upstream (Contributing Back)

Use this when you have improved framework code (inside `./framework/`) while working on VoltX.

1.  **Commit locally:** Commit your changes in the VoltX repository.
2.  **Push to Upstream:** In the VoltX root, run `make sync`.
    - This executes: `git push origin [branch]` followed by `make sync-upstream`.
    - `make sync-upstream` runs: `git subtree push --prefix=framework upstream main`.
3.  **Finalize Local Source:**
    - If the push fails because the local source has `main` checked out, switch the local source to a temporary branch.
    - After the push, go to `/Users/pengcao/projects/serverlessclaw`, merge the updates into `main`, and run `git push origin main`.

## 3. Critical Constraints for Agents

- **Subtree Prefix:** Always use `--prefix=framework` when manually running subtree commands.
- **Remote Names:**
  - `origin`: The VoltX remote.
  - `upstream`: The local path to the `serverlessclaw` repository.
- **Squashing:** Always use `--squash` when pulling to keep the VoltX history clean.
- **Conflict Resolution:** If conflicts occur in `./framework/`, they must be resolved within the VoltX repository first.
