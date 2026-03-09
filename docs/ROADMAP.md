# Serverless Claw Roadmap

Our goal: the most customizable, cost-effective, and self-evolving personal AI agent host.

## ✅ Phase 1: MVP
- [x] SST v3 (Ion) setup
- [x] Telegram Webhook integration
- [x] DynamoDB history persistence
- [x] Basic Tool loop (Calculator, Weather)

## ✅ Phase 2: Developer Foundations
- [x] Standardized `IMemory`, `IChannel`, `ITool` interfaces
- [x] DynamoDB-based session locking (mutex)
- [x] Distilled Long-Term Memory (Reflection Loop)

## ✅ Phase 5: Self-Evolving & Multi-Agent
- [x] 3-Agent Architecture: Main → Coder → Deployer
- [x] EventBridge `AgentBus` for async inter-agent communication
- [x] `dispatch_task` and `trigger_deployment` tools
- [x] AWS CodeBuild sidecar Deployer
- [x] `file_write` tool for Coder Agent

## ✅ Phase 6: Safety Guardrails
- [x] Resource Labeling (Protected file list in `file_write`)
- [x] Deployment Circuit Breaker (5/day limit, DynamoDB-backed, TDD-verified)
- [x] Pre-flight `validate_code` tool
- [x] Human-in-the-Loop prompt instructions

## ✅ Phase 7: Self-Healing & Rollback
- [x] `check_health` tool — `GET /health` probe, rewards with counter decrement
- [x] `trigger_rollback` tool — `git revert HEAD` + redeploy
- [x] Build Monitor: Log-based error analysis and auto-fix loop
- [x] Dead Man's Switch: Scheduled health probe + emergency rollback
- [x] Main Agent orchestrates full deploy→verify→rollback cycle

---

## 🚀 Phase 3: Visibility & Native Observability (High Priority)
- [ ] **Admin Dashboard**: Next.js 16 (Canary) + Tailwind v4 static site to visualize agent logic, memory, and builds.
    - **Style**: "Cyber-Industrial" aesthetic (High-contrast Dark Mode, Glassmorphism, Monospace typography).
    - **Features**: Agent Trace (XYFlow), Self-Healing Logs, Memory Browser.
- [ ] **Claw-Trace**: A built-in, serverless tracing engine that logs every LLM call and tool execution to DynamoDB.
- [ ] **Cost Monitoring**: Real-time AWS and LLM cost breakdown inside your own dashboard.
- [ ] **Multi-Channel Adapters**: Slack and Discord support to broaden the user base.

## 🔥 Phase 4: Power Capabilities
- [ ] **Browser Automation**: Playwright Lambda Layer for autonomous web browsing/actions.
- [ ] **Skill Marketplace**: CLI-based installation of community-contributed tools (`claw install notion`).
- [ ] **Local CLI Chat**: A "Sandbox Mode" to chat with the agent directly in the terminal.
- [ ] **Voice Integration**: Twilio/WebRTC support for voice-enabled agents.

## 🏢 Phase 8: Multi-Tenancy & Scale
- [ ] Agent Swarm Isolation by `employerId` (tenant partitioning).
- [ ] Per-tenant EventBridge filtering.
- [ ] Tenant-aware rate limiting on Circuit Breaker.

## 🔜 Phase 9: Advanced AI Engineering
- [ ] Local Model Tunnel (Ollama / AWS Bedrock).
- [ ] Autonomous cost anomaly detection.
- [ ] Automated "Prompt Engineering" optimization loop.
