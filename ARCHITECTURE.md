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

### 1. Self-Evolution (The Persistence Loop)

The stack evolves by bridging the gap between temporary Lambda execution and persistent Git storage.

```text
+--------------+       +------------------+       +-------------------+
|  Coder Agent |------>|  Staging Bucket  |<------|   AWS CodeBuild   |
| (Writes Code)| upload|    (S3)          | pull  |     (Deployer)    |
+--------------+       +------------------+       +---------+---------+
                                                            |
                                                            v
+--------------+       +------------------+       +-------------------+
|  Main Agent  +------>|  AWS CodeBuild   +------>|   Agent Stack     |
| (Orchestrator)| trigger| (Deployer)       |  sst  | (Self-Update)     |
+--------------+       +------------------+       +---------+---------+
                                                            |
                                                            v
                                                  +-------------------+
                                                  |   GitHub Repo     |
                                                  | (Final Persistence)|
                                                  +-------------------+

### 2. Self-Healing Loop

If a deployment fails or the system becomes unstable, Serverless Claw automatically repairs itself.

```text
    +-------------------+           +-----------+
    |   Main Agent      | <-------+ |  Events   |
    | (Brain/Lambda)    |           +-----------+
    +---------+---------+                 ^
              |                           |
              v                           |
    +---------+---------+           +-----+-----+
    |   Coder Agent     |           |  Monitor  |
    | (Modification)    |           | (Health)  |
    +---------+---------+           +-----+-----+
              |                           ^
              v                           |
    +---------+---------+                 |
    |   Deployer        | ----------------+
    | (CodeBuild/SST)   |
    +-------------------+
```
```

**How it works**:
1. **Coder Agent** implements changes using `file_write` and validates them.
2. **Main Agent** (via tool) zips the modified workspace and uploads it to the **Staging Bucket** (S3).
3. **Main Agent** calls `trigger_deployment`.
4. **CodeBuild** starts:
    - Pulls the latest code from **GitHub**.
    - Pulls the modified files from the **Staging Bucket** and overwrites the local workspace.
    - Runs `pnpm sst deploy`.
5. **On Success**: CodeBuild uses a `GITHUB_TOKEN` to commit and push the staged changes back to the repository, closing the evolution loop.
6. **On Failure**: `Dead Man's Switch` detects the unhealthy state and reverts the last commit in Git.

---

### 3. Cost-Effectiveness & Safety (CodeBuild Edition)

Replacing legacy GitHub Actions cost controls with in-AWS equivalents:

1. **Circuit Breaker**: Max 5 deploys/UTC day tracked in DynamoDB. See [docs/SAFETY.md](./docs/SAFETY.md).
2. **Health Probe Reward**: Successful `GET /health` decrements the counter (-1), allowing continued evolution for healthy changes.
3. **Config-as-Data**: Non-structural changes (prompts, tool params) live in DynamoDB — no deploy needed.
4. **Human-in-the-Loop**: Protected files (`sst.config.ts`, etc.) require explicit Telegram approval before any change deploys.

### 4. LLM Providers
Provider-agnostic interface supporting:
- OpenAI (GPT-5.4 / GPT-5-mini)
- Anthropic (Claude 4.6 Sonnet)
- Google (Gemini 3.1 / Gemini 3 Flash)
- Local models (via Ollama or AWS Bedrock)
