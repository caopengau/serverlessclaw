# Orchestration Flow

> **Navigation**: [← Index Hub](../INDEX.md)

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

### Clarification Protocol (Conversational Mid-task Coordination)

Unlike a standard handoff, the Clarification Protocol allows a sub-agent to pause and seek directions from its initiator without failing the task. It includes built-in timeout resilience and automated retries.

```text
Initiator (Planner)     AgentBus (EB)       Follower (Coder)      Scheduler (EB)
      |                      |                      |                    |
      +--- dispatchTask ---->|                      |                    |
      |                      +---- coder_task ----->|                    |
      |                 [TERMINATE]                 |                    |
      |                      |               [THINK: Ambiguity!]         |
      |                      |<-- seekClarification-+                    |
      |      [EH ROUTE]      |   (question, task)   |                    |
      |                      |       [PAUSE/TERMINATE]                   |
      |                      |                      |                    |
      |                      +--- scheduleTimeout ---------------------->|
      |                      |                      |                    |
      |<-- CONTINUATION_TASK-+                      |                    |
      | (CLARIFICATION_REQUEST)                     |                    |
      |                      |                      |                    |
      |            [ IF TIMEOUT FIRES ]             |                    |
      |                      |<------------------- CLARIFICATION_TIMEOUT +
      |                      |                      |                    |
      |            [ IF RETRY < MAX ]               |                    |
      |                      +-- CLARIFICATION_REQUEST (RETRY) --------->|
      |                      |                      |                    |
      |            [ IF RETRY >= MAX ]              |                    |
      |                      +-- TASK_FAILED ------>|                    |
      |                      +-- OUTBOUND (User)    |                    |
      |                      |                      |                    |
      |            [ IF ANSWERED ]                  |                    |
      +-- provideClarification                      |                    |
      |   (answer) --------->|                      |                    |
      |                      +-- CONTINUATION_TASK->|                    |
      |                 [TERMINATE]                 |                    |
      |                      |              [RESUME with Answer]         |
      |                      |                      |                    |
```

### Parallel Dispatch Protocol (Fan-out/Fan-in)

The Parallel Dispatch Protocol enables an agent to delegate multiple independent sub-tasks concurrently. It uses a barrier timeout to ensure the system remains responsive even if some sub-agents stall.

It supports two aggregation modes for result processing:

- **Summary**: (Default) Aggregates results into a structured Markdown summary for the initiator.
- **Agent-guided**: Invokes an aggregator agent to synthesize results and determine the next logical action based on an optional `aggregationPrompt`.

```text
Initiator (Planner)     AgentBus (EB)       Sub-Agents (xN)      Aggregator (DDB)
      |                      |                      |                    |
      +--- dispatchTask ---->|                      |                    |
      |                      +-- PARALLEL_DISPATCH -+------------------->|
      |                      |                      |             [INIT State]
      |                      +-- <agent>_task (1) ->|                    |
      |                      +-- <agent>_task (2) ->|                    |
      |                      +-- <agent>_task (N) ->|                    |
      |                      |                      |                    |
      |             [ AS SUB-TASKS COMPLETE ]       |                    |
      |                      |<-- TASK_COMPLETED ---+                    |
      |                      +----------------------+------------------->|
      |                      |                      |             [ADD Result]
      |                      |                      |             [IF COMPLETE]
      |                      |<-- PARALLEL_COMPLETED+<-------------------+
      |                      |                      |                    |
      |             [ IF BARRIER TIMEOUT FIRES ]    |                    |
      |                      |<-- BARRIER_TIMEOUT --+                    |
      |                      +----------------------+------------------->|
      |                      |                      |             [TIMEOUT Missing]
      |                      |<-- PARALLEL_COMPLETED+<-------------------+
      |                      |                      |                    |
      |<-- CONTINUATION_TASK-+                      |                    |
      | (PARALLEL_COMPLETED) |                      |                    |
```

### Swarm Consensus Protocol (Voting & Governance)

The Swarm Consensus Protocol provides a mechanism for agents to make collective decisions on high-impact changes. It prevents a single "hallucinating" or compromised agent from making unilateral system alterations.

It supports three voting modes:

- **Majority**: Requires > 50% of participants to vote YES.
- **Unanimous**: Requires 100% of participants to vote YES.
- **Weighted**: Votes are weighted by the agent's current **Reputation Score** (Phase A1).

#### Event Flow

````text
Initiator (Planner)     AgentBus (EB)       Participants (xN)     Consensus Handler (DDB)
      |                      |                      |                    |
      +-- requestConsensus ->|                      |                    |
      |   (proposal, mode)   +-- CONSENSUS_REQUEST -+------------------->|
      |                      |                      |             [INIT State: PENDING]
      |                      |                      |                    |
      |             [ AS AGENTS VOTE ]              |                    |
      |                      |<--- CONSENSUS_VOTE --+                    |
      |                      +----------------------+------------------->|
      |                      |                      |             [RECORD Vote]
      |                      |                      |             [CHECK Threshold]
      |                      |<-- CONSENSUS_REACHED +<-------------------+
      |                      |   (approved: T/F)    |             [STATE: COMPLETED]
      |                      |                      |                    |
      |<-- CONTINUATION_TASK-+                      |                    |
      | (CONSENSUS_REACHED)  |                      |                    |
      |                      |                      |                    |
      ```

      ### Human-Agent Handoff Protocol (Phase B3)

      To prevent conflicting writes and ensure human priority during real-time collaboration, the system implements a **Handoff Protocol**. When a human participant sends a message, all autonomous agents in that session automatically enter **OBSERVE** mode for a short duration (default: 2 minutes).

      - **Trigger**: `Webhook` calls `requestHandoff(userId)` on every incoming message.
      - **Effect**: Agents calling `process()` or `stream()` check `isHumanTakingControl(userId)`. If true, they skip tool execution and return a `HUMAN_TAKING_CONTROL` status.
      - **Duration**: 120 seconds of silence from the human before autonomous loops resume.

      #### Flow

      ```text
      Human User (Telegram)     Webhook (Lambda)      Handoff (DDB)       Autonomous Agent
      |                      |                    |                    |
      +---- "Wait, stop!" -->|                    |                    |
      |                      +-- requestHandoff ->|                    |
      |                      |   (TTL: 120s)      |                    |
      |                      |                    |                    |
      |                      |             [ LATER THAT MINUTE ]       |
      |                      |                    |                    |
      |                      |                    |           [THINK: Next Step?]
      |                      |                    |                    |
      |                      |                    |<-- isHumanTakingControl?
      |                      |                    |------- ( TRUE ) ------>|
      |                      |                    |                    |
      |                      |             [ENTER OBSERVE MODE]
      |                      |             [EXIT / NO TOOLS]
      ```

      ### Granular HITL Tool Approval (Tool-level Gates)


For security-sensitive operations (e.g., deleting data, triggering deployments), tools can be marked with `requiresApproval: true`. The `AgentExecutor` automatically pauses before executing such tools, allowing for granular human oversight. Users can provide optional comments with their approval to guide the agent.

```text
User (Dashboard)       Agent (Lambda)       AgentBus (EB)       High-Risk Tool (DDB)
      |                      |                    |                    |
      +---- "Delete DB" ---->|                    |                    |
      |                      |--- [LLM Thought] ->|                    |
      |                      |                    |                    |
      |                      |--- (1) Emit CHUNK (Thought) ----------->|
      |                      |                    |                    |
      |                      |--- (2) Check Tool: deleteDatabase ---->|
      |                      |        [requiresApproval: true]         |
      |                      |                    |                    |
      |                      |<-- (3) TASK_PAUSED (APPROVAL_REQUIRED) -|
      |                      |                    |                    |
      |<--- [UI: Approve?] --|--- (4) Emit CHUNK (with Options) ------>|
      |   (Optional Comment) |                    |                    |
      |                      |                    |                    |
      +---- [APPROVE] ------>|                    |                    |
      |    w/ Comment        |--- (5) Resume Loop (approvedCalls:[ID])|
      |                      |        (text: comment)                 |
      |                      |                                        |
      |                      |--- (6) EXECUTE ------------------------>|
      |                      |                    |                    |
      |<--- [UI: Success] ---|--- (7) Emit TASK_COMPLETED ------------>|
      v                      |                    v                    v
```

- **Comment Field**: The Dashboard provides a text input for the user to add context to their decision (e.g., "Only delete the staging DB, not production").
- **Labels**: Button labels are clean and professional (e.g., `Approve`, `Clarify`, `Dismiss`) without emojis.

### Dual-Mode Communication (Intent-Based Orchestration)

To balance deterministic coordination with natural user interaction, the system supports two communication modes, toggled via `AgentProcessOptions.communicationMode`.

| Mode     | Target          | Protocol                            | Benefit                                                  |
| -------- | --------------- | ----------------------------------- | -------------------------------------------------------- |
| **JSON** | Agents / System | Native JSON Schema (`strict: true`) | Guaranteed parsing, automated state updates, zero regex. |
| **Text** | Humans (Chat)   | Natural Language                    | Empathy, nuance, and lower token latency.                |

#### Mode Switching Logic

The `Agent` core automatically injects the **Standard Signal Schema** when `communicationMode: 'json'` is requested. It also performs **Intelligent Response Extraction** to ensure human-readable segments (like plans or messages) are still available for logging and dashboards even when the model output is raw JSON.

```text
  [ Task Intent ]
         |
    +----v----+          (communicationMode)
    |  Agent  |----------+----------+
    +---------+          |          |
         |             [JSON]     [TEXT]
         |               |          |
         v               v          v
    [ Executor ]    (Inject Schema) (Standard)
         |               |          |
         v               +----------+
    [ LLM Call ] ----------> [ Response ]
                                |
                    +-----------+-----------+
                    |                       |
             (Extract Text)          (Store JSON)
                    |                       |
             [ User Chat ]           [ System State ]
```

### Standardized Coordination (Enums & Type Safety)

To ensure reliable orchestration across a distributed swarm of agents, Serverless Claw enforces a **Standardized Neural Signal Schema**. Instead of relying on brittle string-based tool calls or event names, all agents utilize centralized enums defined in `core/lib/constants.ts`.

- **`TOOLS`**: Defines the exhaustive list of available agent capabilities (e.g., `dispatchTask`, `triggerDeployment`, `seekClarification`).
- **`TRACE_TYPES`**: Standardizes the phases of agent execution (`LLM_CALL`, `TOOL_RESULT`, `REFLECT`), enabling consistent observability in the dashboard.
- **`MEMORY_KEYS`**: Enforces a strict partition-key strategy for the tiered memory engine (`CONV#`, `FACT#`, `LESSON#`).

This architectural choice minimizes runtime errors, simplifies agent tool-binding, and provides a clear "contract" for any new agent added to the registry.

### Routing Metadata

Every event on the `AgentBus` carries critical routing metadata:

- **`traceId`**: Consolidates all agent steps into a single unified timeline.
- **`initiatorId`**: The ID of the agent that started the task (used to route results back).
- **`depth`**: Current recursion level. The system automatically terminates tasks exceeding the **Recursion Limit** (Default: 15) to prevent infinite loops. This limit is hot-swappable in the Dashboard Settings.

---
````
