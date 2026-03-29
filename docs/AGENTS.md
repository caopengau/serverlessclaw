# Agent Registry & Orchestration

> **Navigation**: [← Index Hub](../INDEX.md)

> **Agent Context Loading**: Load this file when you need to understand the agent roles, their prompts, and how they coordinate via the AgentBus.
> , or add a new sub-agent.

## 🤖 Agent Roster

We distinguish between **Autonomous Agents** (LLM-powered decision-makers) and **System Handlers** (deterministic logic for monitoring and recovery).

### 1. Autonomous Agents (LLM-Powered)

| Agent                   | Runtime                              | Config Source              | Responsibilities                                                                |
| ----------------------- | ------------------------------------ | -------------------------- | ------------------------------------------------------------------------------- |
| **SuperClaw**           | `core/handlers/webhook.ts`           | `core/agents/superclaw.ts` | Interprets user intent, delegates, deploys                                      |
| **Coder Agent**         | `core/agents/coder.ts`               | `AgentRegistry` (Backbone) | Writes code, runs pre-flight checks                                             |
| **Agent Runner**        | `core/handlers/agent-runner.ts`      | `AgentRegistry` (Dynamic)  | Generic runner for any user-defined agent                                       |
| **Strategic Planner**   | `core/agents/strategic-planner.ts`   | `AgentRegistry` (Backbone) | Designs strategic evolution plans                                               |
| **Cognition Reflector** | `core/agents/cognition-reflector.ts` | `AgentRegistry` (Backbone) | Distills memory and extracts gaps                                               |
| **QA Auditor**          | `core/agents/qa.ts`                  | `AgentRegistry` (Backbone) | Verifies satisfaction of deployed changes                                       |
| **Critic Agent**        | `core/agents/critic.ts`              | `AgentRegistry` (Backbone) | Peer review for Council of Agents (security/performance/architect)              |
| **Facilitator**         | `core/agents/prompts/facilitator.md` | `AgentRegistry` (Backbone) | Moderates multi-party collaboration sessions, drives consensus, closes sessions |
| **Swarm Optimizer**     | `core/agents/optimizer.ts`           | `AgentRegistry` (Backbone) | Swarm economist. Audits telemetry and memory to suggest model swaps and pruning |

### 2. System Handlers (Logic-Powered)

| Component                | Runtime                                        | Trigger                                   | Responsibilities                                              |
| ------------------------ | ---------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| **Build Monitor**        | `core/handlers/monitor.ts`                     | CodeBuild Event                           | Observes builds, updates gap status, circuit breaking         |
| **Dead Man's Switch**    | `core/handlers/recovery.ts`                    | EventBridge Schedule (`rate(15 minutes)`) | Deep health checks and emergency rollback orchestration       |
| **Event Handler**        | `core/handlers/events.ts`                      | AgentBus System Events                    | Routes build/health/result/continuation/clarification signals |
| **Notifier**             | `core/handlers/notifier.ts`                    | AgentBus Event                            | Formats and sends messages to Telegram/Slack                  |
| **Real-time Bridge**     | `core/handlers/bridge.ts`                      | AgentBus Event                            | Bridges EventBridge signals to AWS IoT Core (MQTT)            |
| **Parallel Handler**     | `core/handlers/events/parallel-handler.ts`     | `PARALLEL_TASK_DISPATCH`                  | Handles fan-out to multiple agents with barrier timeout       |
| **Cancellation Handler** | `core/handlers/events/cancellation-handler.ts` | `TASK_CANCELLED`                          | Manages DynamoDB-backed task cancellation flags               |
| **Deployer**             | AWS CodeBuild                                  | `buildspec.yml`                           | Runs `make deploy ENV=$SST_STAGE` in isolated environment     |

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
5. **Deploy**: Run `make deploy ENV=dev` (or `make dev` for local stage work). The **Build Monitor** will automatically discover the new agent.

## 🧪 Testing Interfaces (Contract-First)

To ensure coordination doesn't break as we add more agents, follow a **Contract-First** development pattern:

1. **Define Schema**: Add or update the `zod` schema in `core/lib/schema/events.ts` for any new event types or field changes.
2. **Update Types**: Ensure `core/lib/types/agent.ts` matches the schema.
3. **Add Contract Test**: Add a test case to `core/tests/contract.test.ts` to verify your new event pattern.
4. **Verify Handler**: Ensure your agent's handler uses `.parse()` and the correct schema to validate incoming `eventDetail`.

```bash
npx vitest core/tests/contract.test.ts
```

## 🛠️ Engineering Standards (Agent & Human)

To maintain the high technical integrity of the swarm, all contributors (both human and autonomous agents) MUST adhere to these standards when adding or modifying features:

1. **Test-First Development**:
   - **New Features**: Must include at least one unit test file (`.test.ts`) and, if applicable, an integration/contract test.
   - **Bug Fixes**: Must include a regression test that demonstrates the fix.
   - **Coverage**: Maintain or improve existing test coverage.

2. **Documentation Parity**:
   - **Update MDs**: Any change to agent roles, event types, or memory tiers must be immediately reflected in `docs/AGENTS.md`, `docs/MEMORY.md`, or `ARCHITECTURE.md`.
   - **ASCII Diagrams**: Complex flows (especially those involving new event patterns) must be documented with an updated ASCII sequence diagram.

3. **Schema Integrity**:
   - Always update `core/lib/schema/` and `core/lib/types/` before implementing logic.
   - Use strict typing and avoid `any` wherever possible.

4. **Telemetry & Audit**:
   - Ensure all new tools and handlers emit appropriate telemetry (TokenUsage, Reputation signals).
   - Failed autonomous operations must be recorded in the **Negative Memory** tier (`FAILED_PLAN#`).
