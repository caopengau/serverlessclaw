# Safety Guardrails & Policy Enforcement

> **Navigation**: [← Index Hub](../../INDEX.md)

This document defines the safety boundaries and policy enforcement mechanisms that prevent autonomous agents from performing high-risk actions without oversight.

## 🛡️ Guardrail Overview

The system employs a multi-layered safety architecture:

| Guardrail | Where Implemented | Trigger |
| :--- | :--- | :--- |
| **Resource Labeling** | `core/tools` | Any write to a protected file (e.g., `.git`, `sst.config.ts`). |
| **Safety Engine** | `core/lib/safety-engine.ts` | Multi-dimensional policy enforcement (Tiers, Rates, Time). |
| **Recursion Guard** | `core/handlers/events.ts` | Prevents infinite loops (Depth > 15). |
| **Human-in-the-Loop** | `AgentExecutor` | Pauses execution for sensitive tools (e.g., `deleteDatabase`). |
| **Context Compaction** | `core/lib/context.ts` | Prevents context overflow during long autonomous missions. |

---

## 🚦 Granular Safety Tiers

Agents operate under different trust levels, defining which actions require explicit human approval.

| Tier | Deployments | Shell Commands | MCP Tools |
| :--- | :---: | :---: | :---: |
| **`sandbox`** | Approval Required | Approval Required | Approval Required |
| **`staged`** | Approval Required | Auto-Approved | Auto-Approved |
| **`autonomous`** | Auto-Approved | Auto-Approved | Auto-Approved |

> [!NOTE]
> The default tier is `staged` to ensure that all deployments undergo human review while allowing autonomous code modification.

---

## 🧠 Deep Cognitive Health

The system monitors its own "state of mind" to detect degradation or hallucination trends.

- **Completion Rate**: Tracks the ratio of successful vs. failed missions.
- **Reasoning Coherence**: Agents score each other's reasoning quality.
- **Anomaly Detection**: Triggers alerts if the failure rate spikes or token efficiency drops.

---

## 🖇️ Resource Protection

Writes to the following resources are blocked by default and require **Manual Approval**:
- `sst.config.ts` (Stack definition)
- `infra/**` (Infrastructure resources)
- `core/tools/index.ts` (Safety gate implementation)
- `.git/**` (Version control)

---

## 🔄 Proactive Evolution (Class C Actions)

Highly sensitive changes, such as IAM modifications or memory retention policy shifts, are classified as **Class C**. These are never executed immediately but are scheduled with a **1-hour cooling period** for manual audit.

---

## 📡 Related Documentation

- **[RESILIENCE.md](../system/RESILIENCE.md)**: Dead Man's Switch, Self-healing, and persistent Circuit Breakers.
- **[SWARM.md](./SWARM.md)**: Recursive task safety and depth limits.
- **[STANDARDS.md](../governance/STANDARDS.md)**: Quality gates and audit standards.
