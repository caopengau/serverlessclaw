# Self-Evolution & Capability Lifecycle

Serverless Claw is a **self-evolving system** that identifies its own weaknesses, designs its own upgrades, and verifies its own satisfaction.

## The Evolution Loop


```text
+--------------+       +------------------+       +-------------------+
|  Coder Agent |------>|  Staging Bucket  |<------|   AWS CodeBuild   |
| (Writes Code)| upload|    (S3)          | pull  |     (Deployer)    |
+--------------+       +------------------+       +---------+---------+
                                                            |
                                                            v
                                                  +-------------------+
                                                  | Pre-Deployment QA |
                                                  | (validateCode,    |
                                                  |  runTests)         |
                                                  +---------+---------+
                                                            |
                                                            v
+--------------+       +------------------+       +-------------------+
|  SuperClaw  +------>|  AWS CodeBuild   +------>|   Agent Stack     |
| (Orchestrator)| trigger| (Deployer)       |  sst  | (Self-Update)     |
+--------------+       +---------|--------+       +---------+---------+
                                  |
                                  v
                         +-------------------+
                         | Build Monitor     |
                         | (Gap Aging: 30d)  |
                         +---------+---------+
                                  |
                                  v
+--------------+       +------------------+       +-------------------+
|  QA Auditor  +------>|  Mechanical Gate |<------+   User Feedback   |
| (Verifies)   | tool  | (Status: DONE)   | chat  |  (Closes Loop)    |
+--------------+       +------------------+       +-------------------+
```

## Capability Lifecycle

The system's evolution follows a strict, verified hierarchy:

1. **Observation**: Reflector identifies a `strategic_gap` from conversation logs.
2. **Audit & Optimization**: Every 48 hours, the **Strategic Planner** reviews all open gaps.
3. **Planning**: Planner designs a `STRATEGIC_PLAN`.
4. **Council Review** (High-Impact Only): If `impact >= 8`, `risk >= 8`, or `complexity >= 8`, the plan is dispatched to the **Critic Agent** for parallel peer review (Security, Performance, Architect). Plans are only approved if all reviews pass.
5. **Approval**: Depending on `evolution_mode`, the user approves or the system proceeds.
6. **Implementation (Definition of Done)**: Coder Agent MUST implement changes along with **Tests** and **Documentation**.
7. **Pre-Flight Validation**: Coder MUST run `validateCode` and `runTests` before `stageChanges`.
8. **Deployment**: CodeBuild deploys to live environment (No Git push).
9. **Verification**: QA Auditor verifies live satisfaction.
10. **Atomic Sync**: ONLY after QA success, `gitSync` pushes verified code back to the trunk.
11. **Nudging & Completion**: SuperClaw marks gap as `DONE`.

## Self-Healing Loop

If a deployment fails, the **Build Monitor** detects the failure and emits a `SYSTEM_BUILD_FAILED` event.

- **Triage**: SuperClaw analyzes the failure logs.
- **Rollback**: If consecutive failures occur, the **Dead Man's Switch** triggers an emergency Git rollback to the last known stable commit.

## Gap Status Flow

```
OPEN → PLANNED → PROGRESS → DEPLOYED → DONE
  |        |          |           |
  |        v          v           v
  +----<---------------------- FAILED (If max reopen limits hit: 3 attempts)
                                  |
ARCHIVED (auto-archived after 30 days)
```

**Retry Logic:** If a deployed change fails QA or the build fails, the gap is moved back to `OPEN` and the `Coder Agent` is immediately dispatched to fix it. If it fails 3 times, it escalates to `FAILED`.
