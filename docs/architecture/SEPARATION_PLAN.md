# VoltX vs. ServerlessClaw: Architectural Separation Plan

To maintain the "Hub-and-Spoke" integrity and ensure **ServerlessClaw** remains a generic Open-Source (OSS) framework while **VoltX** (Enerlink Nexus) provides the energy domain intelligence, we must enforce a clear separation of concerns.

## 1. Domain vs. Framework Logic

| Layer | Responsibility | Contents | Location |
| :--- | :--- | :--- | :--- |
| **Spoke (Domain)** | Energy Intelligence | VPP Aggregation, Arbitrage, Energy Markets, Site Registry, Modbus/IoT adapters. | `packages/<spoke>-*`, `apps/<spoke>-*` |
| **Hub (Framework)** | Plumbing & Swarm | EventBus, Memory, Safety, Trace Engine, MCP Multiplexer, Auth, Workspaces. | `framework/*` |

## 2. UI & Dashboard Separation

Currently, the Dashboard resides in the framework. To avoid energy-specific code in the generic framework, we will use a **Plugin-driven UI model**.

### 🛠️ In the Framework (Generic)
*   **Workspace Management**: Generic tenant setup.
*   **User Management**: Generic RBAC.
*   **Asset Shell**: A generic "Devices" or "Resources" interface that can be populated by any domain.
*   **UI Primitives**: The "Cyber-Industrial" design system.

### ⚡ In VoltX (Domain)
*   **Energy Assets**: Specific visualizations for Batteries/Inverters.
*   **VPP HUD**: Tactical aggregation stats (MW, Grid state).
*   **Market Operations**: Trading/Arbitrage views.

**Status**: Refactored. The `Devices` page is now a **VoltX Extension** registered via `framework/apps/dashboard/src/extensions/index.ts`. It no longer resides in the framework's hardcoded navigation.

---

## 3. Documentation Strategy

Documentation should follow the same partition to prevent "Context Poisoning."

### 📖 Framework Docs (`framework/docs/`)
*   **System Architecture**: Core silos (Memory, Safety, Trace).
*   **DevOps Standards**: Deployment and release pipelines.
*   **Generic Onboarding**: How to add a new Workspace or User.

### 📚 VoltX Docs (`docs/`)
*   **VPP Operation**: How to coordinate assets.
*   **Energy Domain Onboarding**: How to register a Site and a Battery.
*   **Arbitrage Strategy**: AI reasoning for energy markets.

---

## 4. Immediate Remediation Steps

1.  **Split Onboarding Docs**: 
    - Move VPP-specific sections (Section 2: Devices) from `framework/docs/system/ONBOARDING.md` to `docs/VOLTX-ONBOARDING.md`.
    - Keep Section 1 (Users/Workspaces) in the framework.
2.  **Generalize Devices UI**:
    - Rename `Devices` to `Assets` in the framework's sidebar if we keep it there.
    - Move the energy-specific mock data and logic into a plugin-loaded state.

---

### Question for the USER:
Do you want the **Devices** management interface to be a generic framework feature (useful for other types of devices like servers/IoT) or strictly an energy-specific extension for VoltX?
