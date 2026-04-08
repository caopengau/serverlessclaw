# External Protocols & Adapters

> **Navigation**: [← Index Hub](../../INDEX.md)

Serverless Claw uses a pluggable **Adapter Architecture** to communicate with external systems. This layer normalizes diverse third-party payloads into standardized internal models used by the AgentBus.

## 📥 Input Adapters (External → Internal)

Input adapters receive events from external systems (via webhooks or API polling) and normalize them into a common `InboundMessage` format.

### Normalization Flow

```text
[ External System ]        [ Input Adapter ]        [ InboundMessage ]
+----------------+         +----------------+       +------------------+
| Telegram       | ------> | TelegramAdapter| ----> | { source, userId,|
| Webhook        |         |                |       |   sessionId, text}|
+----------------+         +----------------+       |   attachments,   |
                                                    |   metadata }     |
+----------------+         +----------------+       +--------|---------+
| GitHub         | ------> | GitHubAdapter  | ---->          |
| Webhook/API    |         |                |                v
+----------------+         +----------------+       +------------------+
| Jira           | ------> | JiraAdapter    | ----> | SuperClaw.process|
+----------------+         +----------------+       +------------------+
```

### Implementing a New Adapter

1.  **Define Schema**: Create a Zod schema for the external payload format.
2.  **Implement Interface**: Create a class implementing the `InputAdapter` interface in `core/adapters/`.
3.  **Normalize**: Implement the `parse()` method to return an `InboundMessage`.
4.  **Register**: Export the adapter from `core/adapters/input/index.ts`.

---

## 🏗️ Managed Integration Repositories

For specialized or heavy integrations, adapters are maintained in separate repositories under the `serverlessclaw` organization:

- **GitHub**: [serverlessclaw-integration-github](https://github.com/serverlessclaw/serverlessclaw-integration-github)
- **Slack**: [serverlessclaw-integration-slack](https://github.com/serverlessclaw/serverlessclaw-integration-slack)
- **Jira**: [serverlessclaw-integration-jira](https://github.com/serverlessclaw/serverlessclaw-integration-jira)

---

## 🔌 Tool Protocols (MCP)

Agents communicate with technical environments (Git, Shell, Browser) via the **Model Context Protocol (MCP)**. This ensures tools are structured, discovery-friendly, and secure.

- **Registry**: See `core/tools/index.ts`.
- **Validation**: All tool inputs are validated against JSON schemas before execution.
- **Safety**: Tools performing Class C actions require human approval (via `SafetyEngine`).
