# Serverless Claw: Framework Integration Roadmap

This document tracks the architectural evolution of Serverless Claw from a monolithic application into a **Pluggable Headless Framework**.

## 🎯 Vision

Transform the monorepo into a "Spine & Spokes" architecture where external business applications (e.g., VoltX) can consume core logic, UI, and infrastructure as a standardized, premium framework.

---

## 🚦 Current Status

- **Current Phase**: COMPLETED
- **Overall Completion**: 100%

---

## 🗺️ Roadmap Phases

### ✅ Phase 1: Visual & Brand Decoupling (The Face)

_Goal: Enable whitelabeling and UI reuse without code modification._

- [x] **Semantic Theme System**: Implement functional CSS variables (`--brand-*`, `--surface-*`) for instant rebranding.
- [x] **Headless Logic Extraction**: Move chat state and message processing to `@claw/hooks`.
- [x] **Shared UI Library**: Initialize `@claw/ui` with brand-aware atomic components.
- [x] **Dashboard Decoupling**: Refactor main app to consume internal framework packages.

### ✅ Phase 2: Cognitive Extensibility (The Brain)

_Goal: Allow external apps to inject domain context and custom agent behavior._

- [x] **Prompt Decorators**: Implement a registration point for project-specific system prompt injection.
- [x] **Agent Lifecycle Hooks**: Create hooks for intercepting agent `onStart`, `onMessage`, and `onComplete`.
- [x] **Dynamic Tool Mapping**: Enable project-specific tool discovery based on workspace context.
- [x] **Context Providers**: Implement "Smart Context" bridges to pull data from spoke-specific databases into the core prompt.

### ✅ Phase 3: Governance & Safety (The Shield)

_Goal: Enforce business-specific guardrails and safety policies._

- [x] **Tool Middleware**: Create an interception layer for tool calls (e.g., "VoltX-only" safety checks).
- [x] **Workspace Quotas**: Implement per-tenant token and cost budgets.
- [x] **Auth Bridge**: Standardize multi-tenant identity propagation across all framework layers.
- [x] **Audit Sinks**: Allow projects to subscribe to safety violations and cognitive anomalies.

### ✅ Phase 4: Event & Observability Mirroring (The Spine)

_Goal: Provide external apps with deep visibility into the agentic swarm._

- [x] **Event Mirroring**: Enable mirroring of `AgentBus` events to external queues/webhooks.
- [x] **Telemetry Sinks**: Create standardized interfaces for external trace storage (e.g., sending logs to a client's Datadog).
- [x] **Mission Control API**: Expose real-time state as a headless stream for custom dashboards.

---

## 🛠️ Integration Checklist for New Apps

1. **Visual**: Override CSS variables in `globals.css` scope.
2. **Cognitive**: Register a `ClawPlugin` in `core/lib/plugins`.
3. **Infrastructure**: Add a spoke stack in `sst.config.ts`.
4. **UI**: Inject custom components into named `Slots`.
