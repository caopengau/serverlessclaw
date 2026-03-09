# Serverless Claw: Architecture & Design

> **Navigation**: [← Index Hub](./INDEX.md) | [Agents ↗](./docs/AGENTS.md) | [Tools ↗](./docs/TOOLS.md) | [Safety ↗](./docs/SAFETY.md)

This document covers the AWS topology and data flow. For agent logic and orchestration, see [docs/AGENTS.md](./docs/AGENTS.md).

## Design Philosophy

**Serverless Claw** is built to be:
1.  **Stateless**: The core execution is entirely stateless, with persistence offloaded to highly available managed services (DynamoDB).
2.  **Extensible**: Every major component (Memory, Messaging, Tools) is designed as a pluggable adapter.
3.  **Low Latency**: Optimized for fast startup times to minimize "time-to-first-token".

---

## High-Level System Diagram

```text
+-------------------+       +-----------------------+       +-------------------+
|                   |       |                       |       |                   |
| Messaging Client  +------>+   AWS API Gateway     +------>+   AWS Lambda      |
| (Telegram/Discord)|       | (Webhook Endpoint)    |       | (Agent Brain)     |
|                   |       |                       |       |                   |
+---------+---------+       +-----------------------+       +---------+---------+
          ^                                                           |
          |                  +-----------------------+                |
          |                  |                       |                |
          +------------------+   Messaging API       |<---------------+
                             | (Telegram/Discord)    |
                             |                       |
                             +-----------------------+
                                     |
                                     v
                             +-----------------------+
                             |                       |
                             |   Managed Services    |
                             | (DynamoDB / S3)       |
                             |                       |
                             +-----------------------+
```

---

## Message Processing Flow

```text
User Event      Webhook         LLM Agent         Memory           Tool Plugin
    |              |                |                |                 |
    +------------->|                |                |                 |
    |              +--------------->|                |                 |
    |              |                +--------------->|                 |
    |              |                | (Get History)  |                 |
    |              |                |<---------------+                 |
    |              |                |                |                 |
    |              |                +--------------->|                 |
    |              |                | (Save Message) |                 |
    |              |                |                |                 |
    |              |                +--------------------------------->|
    |              |                |    (Execute Tool if needed)      |
    |              |                |<---------------------------------+
    |              |                |                |                 |
    |              |                +--------------->|                 |
    |              |                | (Save Token)   |                 |
    |              |<---------------+                |                 |
    |<-------------+                |                |                 |
Response
```

---

## Developer Customization

Serverless Claw is designed to be highly customizable at every layer.

### 1. Tool Plugins
Developers can add custom tools by implementing the `Tool` interface.
- **Location**: `src/tools.ts`
- **Capability**: Can reach out to any API or execute any Node.js logic within the Lambda environment.

### 2. Memory Adapters
While the default uses DynamoDB, the system can be adapted to use:
- **Redis (Upstash)** for even lower latency.
- **PostgreSQL (Drizzle/Prisma)** for complex relational memory.
- **S3** for long-term archival.

### 3. Channel Adapters
The webhook handler can be extended to support multiple messaging platforms simultaneously.
- **Routing**: Detect platform from payload headers/body.
- **Formatting**: Platform-specific markdown/rich text conversion.

## Self-Management & Orchestration

Serverless Claw is designed to evolve itself and manage complex agent hierarchies.

### 1. Self-Evolution (GitOps)
The agent can manage its own codebase and infrastructure through a Git-centric feedback loop.

```text
+--------------+       +--------------+       +-------------------+
|              |       |              |       |                   |
|  Main Agent  +------>+  GitHub API  +------>+  GitHub Actions   |
| (Lambda)     |       | (Git Commit) |       | (SST Deploy)      |
|              |       |              |       |                   |
+--------------+       +--------------+       +---------+---------+
       ^                                                |
       |               Self-Update Loop                 |
       +------------------------------------------------+
```

1.  **Code Access**: The agent has a `GITHUB_TOKEN` secret.
2.  **Repo Management**: It can modify `sst.config.ts`, tool definitions, or prompt templates.
3.  **Deployment**: Pushing to `main` triggers an SST deployment via GitHub Actions, effectively updating the agent's own infrastructure.

### 4. Autonomous Deployer (Lambda + CodeBuild)
To fully decouple from external CI/CD (GitHub Actions) while maintaining safety:

```text
+--------------+       +------------------+       +-------------------+
|              |       |                  |       |                   |
|  Main Agent  +------>+  AWS CodeBuild   +------>+   Agent Stack     |
| (Lambda)     |       | (Execution Env)  |       | (Self-Update)     |
|              |       |                  |       |                   |
+--------------+       +---------+--------+       +-------------------+
       |                         |
       |     Protected Layer     |
       +-------------------------+
       |   Bootstrap Stack       |
       | (Deployer & Roles)      |
       +-------------------------+
```

1.  **The Bootstrap Stack**: This is the "God Stack" that defines the deployment engine (CodeBuild) and the necessary permissions. It is marked as **Protected** and is not modifiable by the agent itself.
2.  **The Agent Stack**: This is the "Living Stack" that the agent can modify and redeploy.
3.  **Loop Prevention**: The Agent's IAM policy allows `codebuild:StartBuild` only for projects targeting the `Agent Stack`. It has no permissions to touch the `Bootstrap Stack` or the CodeBuild resource definition itself.

### 3. Cost-Effectiveness & Safety
To prevent excessive GitHub Actions billing and code corruption:

1.  **Pull Request Guardrail**: By default, the agent creates a **Pull Request** instead of pushing to `main`. The user reviews the diff and approves the deployment, preventing "infinite loop" deployments.
2.  **Hot-Reloading (Dynamic Config)**: Non-structural changes (prompts, tool parameters, system messages) are stored in **DynamoDB**. The agent can update these instantly via a tool without triggering a full CI/CD pipeline.
3.  **Change Batching**: The agent is instructed to gather multiple improvements before performing a single "Self-Commit" to minimize build minutes.

### 2. Self-Evolution (3-Agent Loop)

The current production system uses a fully in-AWS self-evolution loop:

```text
User
 │
 ▼
Main Agent (Lambda)
 │  dispatch_task
 ▼
Coder Agent (Lambda) ─── file_write ──► Codebase
 │  validate_code                         │
 │  (passes)                              │
 ▼                                        │
trigger_deployment                         │
 │                                        │
 ▼                                        │
AWS CodeBuild (Deployer) ◄────────────────┘
 │  sst deploy
 ▼
Deployed Stack
 │
 ▼
check_health ──► GET /health
 │
 ├── OK  (counter –1, notify user)
 └── FAIL → trigger_rollback → git revert HEAD → CodeBuild
```

See [docs/SAFETY.md](./docs/SAFETY.md) for guardrail details and [docs/AGENTS.md](./docs/AGENTS.md) for system prompts.

### 4. LLM Providers
Provider-agnostic interface supporting:
- OpenAI (GPT-5.4 / GPT-5-mini)
- Anthropic (Claude 4.6 Sonnet)
- Google (Gemini 3.1 / Gemini 3 Flash)
- Local models (via Ollama or AWS Bedrock)
