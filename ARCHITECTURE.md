# VoltX Architecture: The Spoke Definition

This document defines how VoltX extends the **ServerlessClaw** framework to create an AI-native energy management system.

## 1. Domain Separation

VoltX maintains a strict boundary between the **Engine** (Framework) and the **Intelligence** (Domain Logic).

| Layer | Responsibility | Location |
| :--- | :--- | :--- |
| **Engine** | Orchestration, Bus, Memory, Safety | `framework/` |
| **Intelligence** | Energy Agents, Market Tools, Prompts | `packages/voltx-core/` |
| **Interface** | Dashboard, Visualizers, HITL | `packages/voltx-ui/` |

## 2. The VoltX Plugin

Extension is handled through a single entry point: the `voltxPlugin`. This plugin is registered during the framework's bootstrap phase.

### Injected Capabilities
- **Agents**: 
    - `EnergyManager`: Orchestrates household energy consumption.
    - `GridAuditor`: Monitors tariff changes and optimizes grid injection.
- **Tools**: 
    - `getMarketPrice`: Retrieves real-time energy pricing via MCP.
    - `calculateSavings`: Estimates ROI on solar/battery usage.
- **MCP Servers**: 
    - `energy-mcp`: A local MCP server connecting to smart meter APIs.

## 3. Data Isolation (Principle 11)

VoltX strictly enforces the framework's multi-tenant isolation model. Every request and tool call must be anchored to a `workspaceId` (representing a household or facility) to prevent data leakage between energy nodes.

## 4. Co-evolution Loop

When we identify a generic improvement in the core engine while building VoltX (e.g., a better memory caching strategy), we follow the **Promotion Protocol**:

1. Implement the fix in `framework/core/lib`.
2. Verify via `make test`.
3. Use `make sync-upstream` to contribute the fix back to the Mother Hub.

By doing this, VoltX stays lean and focused on Energy logic, while the underlying platform grows more resilient.

---

> [!TIP]
> For the underlying framework principles, see [Framework Principles](./framework/docs/governance/PRINCIPLES.md).
