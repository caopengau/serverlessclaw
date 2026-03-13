# Self-Evolution & Capability Lifecycle

Serverless Claw is a **self-evolving system** that identifies its own weaknesses, designs its own upgrades, and verifies its own satisfaction.

## The Evolution Loop

The stack evolves by bridging the gap between temporary Lambda execution and persistent storage.

```text
+--------------+       +------------------+       +-------------------+
|  Coder Agent |------>|  Staging Bucket  |<------|   AWS CodeBuild   |
| (Writes Code)| upload|    (S3)          | pull  |     (Deployer)    |
+--------------+       +------------------+       +---------+---------+
                                                            |
                                                            v
+--------------+       +------------------+       +-------------------+
|  SuperClaw  +------>|  AWS CodeBuild   +------>|   Agent Stack     |
| (Orchestrator)| trigger| (Deployer)       |  sst  | (Self-Update)     |
+--------------+       +-----------|------+       +---------+---------+
```

## Capability Lifecycle

The system's evolution follows a strict, verified hierarchy:
1. **Observation**: Reflector identifies a `strategic_gap` from conversation logs.
2. **Audit & Optimization**: Every 48 hours, the **Strategic Planner** reviews all open gaps and `tool_usage` telemetry.
3. **Planning**: Planner designs a `STRATEGIC_PLAN` (Expansion or Pruning).
4. **Approval**: Depending on `evolution_mode` (`hitl` vs `auto`), the user approves or the system proceeds.
5. **Implementation**: Coder Agent writes code and triggers deployment.
6. **Verification**: QA Auditor verifies the satisfaction of the change in real-world usage.

## Self-Healing Loop

If a deployment fails, the **Build Monitor** detects the failure and emits a `SYSTEM_BUILD_FAILED` event.
- **Triage**: SuperClaw analyzes the failure logs.
- **Rollback**: If consecutive failures occur, the **Dead Man's Switch** triggers an emergency Git rollback to the last known stable commit.
