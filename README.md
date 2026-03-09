# Serverless Claw

**Serverless Claw** is a self-evolving, cost-efficient AI agent platform built on AWS using [SST (v3/Ion)](https://sst.dev). It hosts intelligent agents that can receive messages, use tools, and autonomously modify and redeploy their own infrastructure.

## Key Features

- **Zero Idle Costs** — powered by AWS Lambda, pay per invocation only
- **Self-Evolving** — the agent can write code, validate it, and redeploy itself safely
- **Multi-Agent Orchestration** — Main Agent delegates to a Coder Agent via EventBridge
- **Safety-First** — circuit breakers, protected resource labeling, health probes, and rollback
- **Pluggable** — swap memory backends, LLM providers, or messaging channels

## Quick Start

```bash
pnpm install
npx sst secret set OpenAIApiKey YOUR_KEY
npx sst secret set TelegramBotToken YOUR_TOKEN
pnpm exec sst deploy
```

## Documentation

📖 Start with **[INDEX.md](./INDEX.md)** — the documentation hub for both humans and agents.

| Doc | Purpose |
|-----|---------|
| [INDEX.md](./INDEX.md) | **Hub** — start here, progressive context loading map |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System topology & AWS resource diagram |
| [docs/AGENTS.md](./docs/AGENTS.md) | Agent roster, orchestration flow, prompt summaries |
| [docs/TOOLS.md](./docs/TOOLS.md) | Full tool registry & deployment lifecycle |
| [docs/SAFETY.md](./docs/SAFETY.md) | Circuit breakers, rollback, HITL guardrails |
| [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) | Dev workflow & documentation standards |
| [docs/RESEARCH.md](./docs/RESEARCH.md) | Architectural decisions & design research |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Planned features |

## License
MIT
