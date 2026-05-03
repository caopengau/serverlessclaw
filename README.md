# ⚡ VoltX: AI-Native Energy Management Platform

VoltX is an AI-native platform designed for intelligent energy management, built on the **ServerlessClaw** headless framework. It leverages a multi-agent swarm architecture to optimize energy consumption, monitor market prices, and automate grid interactions.

## 🏗️ Architecture: Hub-and-Spoke

VoltX follows a strict **Hub-and-Spoke** architecture to ensure clean separation between the core framework and application-specific logic.

*   **The Hub ([framework/](./framework/))**: A managed synchronization of the [ServerlessClaw](https://github.com/serverlessclaw/serverlessclaw) framework. It provides the core "Plumbing": EventBus, Memory, SafetyEngine, and the Unified MCP Multiplexer.
*   **The Spoke ([packages/](./packages/))**: Contains the VoltX domain logic.
    *   `voltx-core`: Custom agents (Energy Manager, Grid Auditor), energy tools, and market adapters.
    *   `voltx-ui`: The dashboard and agentic interface for energy monitoring.

## 🔌 Extension via Plugin System

VoltX customizes the framework using the **VoltX Plugin**. This architectural layer allows us to inject energy domain knowledge into the core without polluting the framework's core directories.

### Registration Pattern
```typescript
import { PluginManager } from './framework/core/lib/plugin-manager';
import { voltxPlugin } from './packages/voltx-core';

// During bootstrap, register the VoltX domain plugin
await PluginManager.register(voltxPlugin);
```

## 🔄 Repository Management (Two-Way Sync)

We maintain a two-way synchronization with the canonical ServerlessClaw repository to benefit from global co-evolution.

### 1. Downstream Evolution
Pull the latest architectural innovations and security guardrails from the Mother Hub:
```bash
make sync-downstream
```

### 2. Upstream Promotion
Promote core framework fixes or generic enhancements (made within the `framework/` directory) back to the canonical repository:
```bash
make sync-upstream
```

## 🚀 Getting Started

### Prerequisites
- Node.js v24.x
- pnpm v9+
- AWS CLI configured with a valid profile

### Installation
```bash
pnpm install
```

### Development
```bash
make dev # Starts local development via SST Ion
```

### Quality Gates
```bash
make check  # Lint, Format, Type-check
make test   # Run full test suite
make gate   # Combined quality sweep
```

---

> [!NOTE]
> For detailed framework documentation, refer to the [Framework Docs](./framework/docs/INDEX.md).
