# Serverless Claw Roadmap

Our goal is to build the most customizable and cost-effective personal AI agent host.

## Phase 1: MVP (Current)
- [x] Initial SST v3 (Ion) Setup.
- [x] Telegram Webhook integration.
- [x] DynamoDB basic history persistence.
- [x] 2026 Model Integration (GPT-5-mini default).
- [x] Basic Tool loop (Calculator, Search).

## Phase 2: Developer Foundations (Q2 2026)
- [ ] **Standardized Adapters**: Define TypeScript interfaces for `IMemory`, `IChannel`, and `ITool`.
- [ ] **Session Locking**: Implement DynamoDB-based mutex to handle concurrent webhooks safely.
- [ ] **Distilled Memory**: Implementation of the "Reflection" loop to summarize long-term user facts.
- [ ] **pnpm Workspace Support**: Split core logic from demo implementations.

## Phase 3: Capabilities Expansion (Q3 2026)
- [ ] **Multi-Channel Router**: Single Lambda handling Telegram, Discord, and Slack via routing logic.
- [ ] **Browser Automation**: Integration with `Playwright` via AWS Lambda Layers or external sandboxes.
- [ ] **Local Model Tunnel**: Support for Ollama or local inference backends for privacy-first users.

## Phase 4: Ecosystem & UI (Q4 2026)
- [ ] **Admin Dashboard**: An SST-hosted React Site to view agent logs, memory, and tool usage.
- [ ] **Plugin Marketplace**: A repository of community-built AgentSkills.
- [ ] **Voice Support**: Twilio/WebRTC integration for real-time talk mode.
