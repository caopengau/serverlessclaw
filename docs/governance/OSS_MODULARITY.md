# ServerlessClaw: OSS Modularity Strategy

> **Design Goal**: Keep the core lean, fast, and domain-agnostic. Support "Pay-only-for-what-you-use" architecture.

As a generic Open Source Software (OSS) framework, ServerlessClaw must cater to a wide range of use cases—from simple chatbots to high-frequency industrial IoT controllers. To prevent architectural bloat, we follow a **Tiered Capability Model**.

---

## 🏗️ The Tiered Capability Model

Capabilities are categorized into three tiers. Only Tier 1 belongs in the canonical OSS `core` and `infra` packages.

### Tier 1: The Canonical Core (Lean & Mean)
*Focus: Agentic Primitives & Cloud-Native Basics*
- **Agent Orchestration**: Base agent classes, mission loops, and memory management.
- **MCP Integration**: The bridge for tools and server connectivity.
- **Memory/RAG**: Basic vector and KV storage abstractions.
- **Cloud-Native Infra**: AWS Lambda, DynamoDB, and EventBridge adapters.
- **Security**: Base guardrails and RBAC interfaces.

### Tier 2: Standard Modules (Optional OSS)
*Focus: Common but non-essential features (Installable packages)*
- **Multi-Human Collaboration**: Real-time presence and shared workspaces.
- **Standard Telemetry**: ROI tracking and basic audit logs.
- **GitHub/Slack Integration**: Pre-built adapters for common platforms.
- **Generic Billing**: Metering and subscription logic.

### Tier 3: Specialized Extensions (Domain/Industry Specific)
*Focus: High-performance or niche infrastructure (Managed or Separate Repos)*
- **High-Frequency Telemetry**: MQTT/WebSocket ingestion for >100 signals/sec.
- **Edge Runtime**: Lightweight runtimes for sub-5-minute dispatch in offline/low-latency sites.
- **Industrial Connectors**: Modbus, DNP3, and specialized hardware protocol adapters.
- **Market Trading Agents**: Domain-specific bidding logic and grid participation algorithms.

---

## 🛠️ Implementation Guidelines

### 1. "Pay-only-for-what-you-use"
Features in Tier 2 and Tier 3 must be implemented as **optional packages** or **dynamic imports**. If a feature is not enabled in `framework.config.ts`, its dependencies should not be included in the deployment bundle.

### 2. Interface over Implementation
The `core` package should only define **Interfaces** (e.g., `IBus`, `IMarketAdapter`). The "heavy" implementations (e.g., `IoTCoreBus`, `EnergyMarketAgent`) must live in their respective extension packages.

### 3. Tree-Shakable Infrastructure
The `@serverlessclaw/infra` package should be organized into granular exports. Importing a `Storage` utility should not transitively pull in the `EdgeRuntime` or `Billing` logic.

### 4. Application-Level Composition
Applications (like **Voltx**) are responsible for composing the framework core with the specific set of extensions required for their domain.

---

## 📂 Directory Mapping (Refactored Vision)

- `packages/core`: Tier 1 (Interfaces, Base Classes)
- `packages/infra`: Tier 1 (AWS standard implementation)
- `packages/extensions-collaboration`: Tier 2 (Optional)
- `packages/extensions-iot-edge`: Tier 3 (Specialized)
- `apps/voltx`: Consumes Core + Infra + IoT-Edge

---
*Last Updated: 2026-05-14*
