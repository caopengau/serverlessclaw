# Serverless Claw

**Serverless Claw** is a high-performance, cost-efficient, and scalable implementation of the [OpenClaw](https://github.com/openclaw/openclaw) AI agent stack, built on AWS using [SST (v3/Ion)](https://sst.dev).

## Why Serverless?

Traditional AI agents often require long-running servers to maintain WebSocket connections and local state. **Serverless Claw** reimagines this architecture:
- **Zero Idle Costs**: Pay only for the milliseconds your agent is actually processing.
- **Auto-Scaling**: Seamlessly handles one or one thousand concurrent users.
- **Reliability**: Leverages AWS Lambda and DynamoDB for institutional-grade stability.

## Architecture

- **AWS Lambda**: The "brain" of the agent, executing tasks and processing webhooks.
- **Amazon DynamoDB**: Persistent session memory and state storage (replaces local markdown files).
- **SST Ion**: Infrastructure as Code for seamless deployment and secret management.
- **Tool Framework**: Extensible engine for mathematical calculations, web search, and more.

## Quick Start

### 1. Prerequisites
- [pnpm](https://pnpm.io/) installed.
- AWS credentials configured.
- A Telegram or Discord Bot Token.

### 2. Installation
```bash
pnpm install
```

### 3. Configuration
Set your secrets:
```bash
npx sst secret set OpenAIApiKey YOUR_KEY
npx sst secret set TelegramBotToken YOUR_TOKEN
```

### 4. Deployment
```bash
pnpm exec sst deploy
```

## Documentation
For a detailed guide on deployment and integration, see the [Walkthrough](https://github.com/caopengau/serverlessclaw/blob/main/walkthrough.md) (or local file).

## License
MIT
