# Agent Architecture & Orchestration

> **Agent Context Loading**: Load this file when you need to modify agent logic, prompts, communication patterns, or add a new sub-agent.

## 🤖 Agent Roster

We distinguish between **Autonomous Agents** (LLM-powered decision-makers) and **System Handlers** (deterministic logic for monitoring and recovery).

### 1. Autonomous Agents (LLM-Powered)

| Agent | Runtime | Config Source | Responsibilities |
|-------|---------|---------------|-----------------|
| **SuperClaw** | `core/handlers/webhook.ts` | `core/agents/superclaw.ts` | Interprets user intent, delegates, deploys |
| **Coder Agent** | `core/agents/coder.ts` | `AgentRegistry` (Backbone) | Writes code, runs pre-flight checks |
| **Worker Agent** | `core/agents/worker.ts` | `AgentRegistry` (Dynamic) | Generic runner for any user-defined agent |
| **Strategic Planner** | `core/agents/strategic-planner.ts` | `AgentRegistry` (Backbone) | Designs strategic evolution plans |
| **Cognition Reflector** | `core/agents/cognition-reflector.ts` | `AgentRegistry` (Backbone) | Distills memory and extracts gaps |
| **QA Auditor** | `core/agents/qa.ts` | `AgentRegistry` (Backbone) | Verifies satisfaction of deployed changes |

### 2. System Handlers (Logic-Powered)

| Component | Runtime | Trigger | Responsibilities |
|-----------|---------|---------|------------------|
| **Build Monitor** | `core/handlers/monitor.ts` | CodeBuild Event | Observes builds, updates gap status, circuit breaking |
| **Dead Man's Switch** | `core/handlers/recovery.ts` | EventBridge Schedule | Hourly health checks, emergency git rollback |
| **Notifier** | `core/handlers/notifier.ts` | AgentBus Event | Formats and sends messages to Telegram/Slack |
| **Real-time Bridge** | `core/handlers/bridge.ts` | AgentBus Event | Bridges EventBridge signals to AWS IoT Core (MQTT) |
| **Deployer** | AWS CodeBuild | `buildspec.yml` | Runs `sst deploy` in isolated environment |

---

## Orchestration Flow (Asynchronous "Pause and Resume")

Serverless Claw uses an asynchronous, non-blocking orchestration pattern. Agents do not wait for results; they emit tasks and terminate, resuming only when a completion event is routed back to them.

```text
User (Telegram)       SuperClaw (Lambda)       AgentBus (EB)       Specialized Agent (Coder)
      |                      |                      |                      |
      +---- "Feature X" ---->|                      |                      |
      |                      +--- dispatchTask ---->|                      |
      |                      | (initiator:SC, dep:0)|                      |
      |                      |                      +---- coder_task ----->|
      |                 [TERMINATE]                 |                      |
      |                      |                      |                      |
      |                      |                      |       [THINK & EXECUTE]
      |                      |                      |                      |
      |                      |                      |<--- TASK_COMPLETED --+
      |                      |                      | (result, traceId, SC)|
      |                      |      [EH ROUTE]      |       [TERMINATE]
      |                      |                      |
      |                      |<-- CONTINUATION_TASK-+
      |                      | (result, depth: 1)   |
      |                      |                      |
      |                      +--- "X Completed" --->|
      v                      |                      v
```

### Routing Metadata
Every event on the `AgentBus` carries critical routing metadata:
- **`traceId`**: Consolidates all agent steps into a single unified timeline.
- **`initiatorId`**: The ID of the agent that started the task (used to route results back).
- **`depth`**: Current recursion level. The system automatically terminates tasks exceeding the **Recursion Limit** (Default: 50) to prevent infinite loops. This limit is hot-swappable in the Dashboard Settings.

---

## Co-Management & Evolution

Agents are not just autonomous; they are **co-managed** via the ClawCenter dashboard, structured into four sectors: **Intelligence**, **Evolution**, **Infrastructure**, and **Observability**.

### 1. Neural Agent Registry (Evolution)
Users can register and configure agents in the **Evolution** sector. 
- **Persona**: Define the system prompt (instructions) for the agent.
- **Dynamic Scoping**: Toggle tools on/off for specific agents without redeploying.
- **Immediate Availability**: Once registered, the SuperClaw can immediately delegate tasks to the new node via `dispatchTask`.

### 2. Global Optimization Policy (Infrastructure)
Users can set a global `optimization_policy` to control system-wide reasoning depth:
- **AGGRESSIVE**: Forces `DEEP` reasoning for all nodes (Highest Quality, Highest Cost).
- **CONSERVATIVE**: Forces `FAST` reasoning (Lowest Latency, Lowest Cost).
- **BALANCED**: Respects the task's intended profile.

### 3. Evolutionary Lifecycle (Verified Satisfaction)

Serverless Claw is a **self-evolving system** that identifies its own weaknesses and implements its own upgrades.

```text
    +-------------------+       1. OBSERVE        +-------------------+
    |   Cognition       |<------------------------|   Conversations   |
    |   Reflector       |      (Signals)          |   (User context)  |
    +---------+---------+                         +-------------------+
              |
              | 2. LOG STRATEGIC_GAP (DDB: OPEN)
              v
    +---------+---------+       3. DESIGN         +-------------------+
    |   Strategic       |------------------------>|   Strategic Plan  |
    |   Planner         |      (DDB: PLANNED)     |   (Proposal)      |
    +---------+---------+                         +-------------------+
              |                                             |
              | 4. DISPATCH_TASK (if auto/approved)         | (Notify)
              |    [APPROVAL GATE]                          v
              v                                     +-------------------+
    +---------+---------+       5. IMPLEMENT        |   Human Admin     |
    |   Coder           |------------------------>|   (HITL Mode)     |
    |   Agent           |      (DDB: PROGRESS)      +-------------------+
    +---------+---------+                         
              |
              | 6. TRIGGER_DEPLOYMENT (SST)
              |    [CIRCUIT BREAKER]
              v
    +---------+---------+       7. MONITOR         +-------------------+
    |   Build           |------------------------>|   Gap Status      |
    |   Monitor         |      (DDB: DEPLOYED)    |   (Live in AWS)   |
    +---------+---------+                         +-------------------+
              |
              | 8. AUDIT & VERIFY (Reflector Audit)
              v
    +---------+---------+       9. SATISFACTION    +-------------------+
    |   QA Auditor      |------------------------>|   Status: DONE    |
    |   Agent           |      (User Feedback)    |   (Loop Closed)   |
    +-------------------+                         +-------------------+
```

1.  **Observation**: The **Cognition Reflector** analyzes interactions to find "I can't do that" moments or complex failures.
2.  **Gap Analysis**: Failures are logged as `strategic_gap` items in DynamoDB, ranked by **Impact** and **Urgency**.
3.  **Strategic Planning**: The **Strategic Planner** reviews gaps during a **deterministic 24-hour review**. It designs a STRATEGIC_PLAN and moves gaps to `PLANNED`.
4.  **Execution**: Once the plan is approved (or automatically triggered in `auto` mode), the **Coder Agent** moves gaps to `PROGRESS`, writes the code, and triggers a deployment.
5.  **Technical Success**: The **Build Monitor** detects a successful CodeBuild run and moves gaps to `DEPLOYED`.
6.  **Verified Satisfaction**: The **QA Auditor** (via Reflector Audit) monitors subsequent conversations. If the user successfully uses the new capability, the Reflector marks the gap as `DONE`.

---

## 🦾 The Backbone Registry

The system identity is defined in `core/lib/backbone.ts`. This centralized registry acts as the "genetic code" of the stack. The **Build Monitor** uses this registry to dynamically generate the neural map visualized in the dashboard.

### Permissions vs. Topology

- **Topology Connectivity**: Declared in `backbone.ts` (for backbone nodes) or via the Dashboard (for custom nodes). This is used only for **visualization** in System Pulse.
- **IAM Permissions**: Managed in `infra/agents.ts` via the `link` property. This is the **hard security layer**.

> [!WARNING]
> Adding a connection in the Dashboard or `backbone.ts` does **NOT** automatically grant AWS permissions. You must still modify `infra/agents.ts` to link new resources.

## 🛠️ Adding a New Agent

To evolve the system with a new specialized node:

1. **Implement**: Create `core/agents/<name>.ts` with the agent's logic and tools.
2. **Register Identity**: Add the agent to `BACKBONE_REGISTRY` in `core/lib/backbone.ts`.
3. **Link Infra**: In `infra/agents.ts`, create the Lambda function and link necessary resources.
4. **Subscribe**: Ensure the agent is subscribed to its task type in the EventBus.
5. **Deploy**: Run `sst deploy`. The **Build Monitor** will automatically discover the new agent.
