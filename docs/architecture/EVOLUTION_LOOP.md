# Total Quality & Evolution Loop

The **Cognitive Evolution Loop** is the core mechanism by which the Serverless Claw swarm iteratively improves its own reasoning capabilities without manual engineering intervention for every failure.

## 🌀 The Spec-Driven Evolution Cycle (ASCII Diagram)

```text
       [ SIGNAL ]                    [ SPEC DRAFTING ]                 [ HITL APPROVAL ]
    ----------------              ----------------------              -------------------
    |              |              |                    |              |                 |
    |  Real-world  |------------->|  Strategic Planner |------------->| Dashboard Spec  |
    |  Failure /   | (EventBridge)| (EARS Spec Draft)  | (DDB State)  | Editor & Gate   |
    |  Metabolic   |              |                    |              |                 |
    ----------------              ----------------------              -------------------
           ^                                                                   |
           |                                                                   | User Approved
           | Promote                                                           | Spec Contract
           | to Prod                                                           v
    ----------------              ----------------------              -------------------
    |              |              |                    |              |                 |
    |  DEPLOYED    |              |  QA Auditor        |              | Coder &         |
    |  CAPABILITY  |<-------------| (Adversarial Spec  |<-------------| Researcher      |
    |  (Dynamic)   | (Verify DoD) |  Audit Gate)       | (Git Patch)  | (Evolution CWD) |
    ----------------              ----------------------              -------------------
```

## 🛡️ Tool Safety & Reputation Calibration Flow (Hand ↔ Shield ↔ Scales)

During the execution cycle, when an agent intends to execute an action/tool, the execution is gated by the Safety Engine (Shield) and evaluated dynamically using the agent's current reputation score tracked by the Trust Manager (Scales).

```text
  [ Hand (Silo 2: Executor) ]      [ Shield (Silo 3: Safety) ]      [ Scales (Silo 6: Trust) ]
      |                                        |                                  |
      |--- 1. executeSingleToolCall ---------->|                                  |
      |                                        |--- 2. evaluateAction ---------->| (Read Agent Config
      |                                        |<-- 3. Return configuration -----|  & Trust Score)
      |                                        |                                  |
      |                                        |--- 4. Enforce Safety Policies ->|
      |                                        |      (RBAC, Access Control,      |
      |                                        |       Blast Radius Class C)      |
      |                                        |                                  |
      |<-- 5. SafetyEvaluationResult ----------|                                  |
      |                                        |                                  |
      |--- 6. If blocked: skip execution ------>|                                  |
      |       If allowed: run tool & get res   |                                  |
      |                                        |                                  |
      |--- 7. recordToolAnalytics ------------>|                                  |
      |                                        |--- 8. Update Reputation -------->|
      |                                        |       (Success Bump /            | (Write/Increment
      |                                        |        Failure Penalty)          |  Atomic Clamping)
```

## 🏗 Key Components

### 1. Signal Receipt (Pulse Health)

Every agent execution generates a trace. Failures are captured by the `reputation-handler` and aggregated into hourly buckets. Low reputation scores (Principle 12) trigger a "Metabolic Gap" signal.

### 2. Cognition Reflector (Intelligence Hub)

The Cognition Reflector analyzes the error distribution and session history. If a "Reasoning Failure" or "Knowledge Gap" is detected, it pulls the full trace and initial context. A specialized LLM compares the intent vs. the result and generates a **Reflection Report** containing updated facts, lessons, and capability gaps.

#### Semantic Deduplication

To prevent duplicate gap reports, the Reflector uses **Semantic Deduplication**. It queries existing open gaps and compares them against new findings. If a similar gap exists, it updates the existing gap's metadata (impact/urgency) instead of creating a new one.

### 3. Evolution Sandbox (Isolated Replay)

To prevent "Memory Drift" or "Reputation Poisoning" during testing, the sandbox runs in **Isolated Mode**:

- `isIsolated: true`: Prevents persistence to DynamoDB memory.
- `source: PLAYGROUND`: Excludes results from reputation metrics.
- `TraceSource.UNKNOWN`: Bypasses default reflection checks.

### 4. Registry Promotion (Cognitive Lineage)

Once verified in the sandbox, the change is committed.

- **Prompt Hash**: Ensures uniqueness of the behavioral change.
- **Atomic Versioning**: Increments the agent version (e.g., v1 -> v2) to track historical lineage.
- **Reputation Reset**: Optionally resets specific failure flags for the new version to allow for a fresh performance baseline.

### 5. Spec-Driven Evolution Contracts (SDD Lifecycle)

Capability evolution is governed strictly by the **Technical Specification contract** statefully saved in DynamoDB (`PLAN#${gapId}`).

- **Strategic Planner (Drafting)**: Formulates the plan and writes the initial EARS specification.
- **Human Developer (HITL Approval)**: Reviews, refines, and saves updates using the monospaced Spec Editor in the dashboard, setting the target contract in DynamoDB.
- **Coder & Researcher Agents (Ground Work)**: Automatically fetch the user-approved specs from DynamoDB and inject them into their prompts as `[TARGET_TECHNICAL_SPECIFICATIONS]` to focus implementation and discovery on the exact design criteria.
- **QA Agent (Audit Gate)**: Auditor runs semantic validation directly against the EARS acceptance criteria to verify the evolution DoD.

---

> [!IMPORTANT]
> The **Evolution Sandbox** is air-gapped. Any tools executed within the sandbox that interact with external APIs must be handled by their respective MCP servers with proper safety tiers enabled.

> [!TIP]
> Cognitive Evolution is most effective when paired with **Pulse Health** monitoring to detect degradation early before failures cascade through the swarm.
