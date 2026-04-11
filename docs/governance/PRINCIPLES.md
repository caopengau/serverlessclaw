# Serverless Claw Principles and Quality Standards

This document outlines the core principles, quality standards, and missions that govern the self-evolving stack of Serverless Claw.

## 🎯 Core Design Principles

The system architecture follows nine foundational philosophies:

1. **Stateless Core:** Execution is entirely stateless with persistence offloaded to highly available managed services (DynamoDB) using Tiered Retention.
2. **AI-Native:** Optimized for agent-human pair programming. Prioritizes semantic transparency, strict neural typing, and direct schema definitions over traditional boilerplate.
3. **Safety-First:** Multi-layered guardrails including Circuit Breakers, Recursion Limits, protected scopes, and role-based access control (RBAC).
4. **Proactive & Efficient:** Uses a "Trigger-on-Message" smart warm-up strategy rather than rigid scheduling or persistent heartbeats to minimize idling costs.
5. **Low Latency:** Optimized for fast startup times with Real-time Streaming (MQTT) for instantaneous feedback. Latency goals must always be declared with a percentile and workload shape (for example: retrieval p95 under defined concurrency).
6. **Extensible:** Every major component (Memory, Messaging, Tools) is designed as a pluggable adapter.
7. **Multi-Lingual:** Employs a "Baseline English Strategy" where core reasoning prompts are in English for maximum AI performance, but interactions are dynamically localized. Safety policy behavior must remain consistent across supported languages.
8. **Stable Contextual Addressing:** Uses deterministic FNV-1a hashing for session identifiers to ensure stable sort-key (SK) mapping in DynamoDB, enabling sub-50ms retrieval across stateless execution environments. Collision handling and namespace boundaries must be explicitly enforced.
9. **Trust-Driven Mode Shifting:** Autonomy is earned, not statically configured. Agents that sustain a `TrustScore >= 95` for a defined epoch are authorized to dynamically shift their own operating mode from HITL to AUTO without explicit human approval, emitting a notification to the Co-Management Hub rather than a blocking request.
10. **Lean Evolution:** Every line of code is a maintenance liability. The system prioritizes minimal viable implementations and regular extraction of common patterns into core libraries over duplication. Proactive deletion of redundant or low-utilization code is considered a primary evolution success metric.

## ⚖️ Governance and Autonomy Boundaries

Autonomy is a capability, not a blanket permission. Every proposed change is risk-classified before execution:

- **Class A (Auto-Allowed):** Default autonomous. Low-risk prompt/docs refactors and non-sensitive tuning that pass all quality gates.
- **Class B (Dynamic Auto):** Fully autonomous (AUTO) when the acting Agent's `TrustScore >= 80`. If trust is lower, dynamically downgrades to Human-in-the-Loop (HITL) with Peer Review.
- **Class C (Trust-Gated Evolution):** Any changes involving IAM, infra topology, memory retention, external tool permissions, deployment controls, or security guardrails. Requires human approval **UNLESS** SuperClaw's systemic `TrustScore >= 95`.
  - *High-Trust Timeout:* If `TrustScore >= 95` and human approval times out, the system safely executes a **Proactive Trunk Evolution**.
  - *Low-Trust Timeout:* If `TrustScore < 95`, a timeout defaults to **Blocked (Fail-Closed)**.
- **Class D (Blocked & Conflict Resolution):** Policy-prohibited changes or actions that exceed declared blast-radius limits. If conflicting human instructions occur, the system checks the Facilitator Agent's `TrustScore`. If `>= 90`, the Facilitator executes a **Strategic Tie-break** autonomously. If `< 90`, the action is permanently Blocked.

All autonomous actions must emit immutable decision logs: who/what proposed the change, risk class, approving authority, evidence bundle, and rollback plan.

## 🧬 The Self-Evolution Mission & Lifecycle

The ultimate mission of Serverless Claw is to act as a **self-evolving system** that identifies its own weaknesses, designs its own upgrades, and verifies its own satisfaction. The swarm executes this through a strict hierarchical loop of **Event-Based State Transitions**:

1. **Observation & Audit:** The Reflector identifies `strategic_gaps` from conversations, which the Strategic Planner periodically audits.
2. **Planning & Council Review:** The Planner designs a `STRATEGIC_PLAN`. High-impact/risk changes require parallel peer review by the Critic Agent (Security, Performance, Architect), with risk class attached to each change item.
3. **Implementation & Pre-Flight:** The Coder Agent implements the change. A strict **Definition of Done** dictates that all code must be accompanied by **Tests** and **Documentation**. Before submission, agents must perform a **Refactor for Leanness**: identifying and removing redundant logic, simplifying complex conditionals, and ensuring no boilerplate was introduced. Code must be compatible with AI-readiness parsers (e.g., avoiding BigInt literals in favor of `BigInt()` constructors).
4. **Atomic Deployment & Sync:** Changes are deployed via CodeBuild to the trunk-aligned environment (no direct Git pushes). Build metadata, provenance evidence, and decision metadata are atomically synced to the gaps they resolve to prevent state loss.
5. **Verification & Healing:** The QA Auditor verifies live satisfaction against pre-declared acceptance metrics using a combination of deterministic tests and **LLM-as-a-Judge** semantic evaluation. If successful, an Atomic Sync (`gitSync`) pushes the verified code back to the trunk. If it fails, a "Dead Man's Switch" can trigger an emergency rollback. The QA Auditor is authorized to evolve the deterministic test suite to match new system behaviors.

## 🛡️ Quality Standards & Gates

Quality is non-negotiable and strictly enforced through automated physical gates before any evolutionary code is merged:

- **Mandatory Quality Sweeps:** Every push or merge triggers a full sweep (`make gate` / `make check`) checking linting, formatting, type-checking, and tests, augmented by semantic verification gates.
- **AI-Readiness:** The system runs an automated AI-readiness scan (`make aiready`) which requires a score of **80+** to proceed.
- **Cognitive Health Monitoring:** The system constantly analyzes agent reasoning coherence (0-10 scale), memory health, and anomaly detection.
- **Hard Security Layer:** System resources require hard IAM permission links defined in infrastructure (`infra/agents.ts`). Any unauthorized API calls return `PERMISSION_DENIED` and trigger a **Non-Blocking Approval Loop**, which transitions to a **Proactive Trunk Evolution** via an asynchronous event if timed out.
- **Consensus & Conflict Resolution:** During multi-party collaborations, a Facilitator Agent maintains strict neutrality, ensures turn-taking, and drives consensus. If conflicting human instructions arise, the agent initiates an **Event-Driven Conflict Resolution Timeout**. If unresolved, the system checks the Facilitator's `TrustScore`: if `>= 90`, the Facilitator performs a **Strategic Tie-break** to continue evolution; if `< 90`, the action fails safely. No compute resources wait for resolution; the system re-hydrates only upon a result or timeout signal.

## 📏 Reliability and Competitive SLOs

To remain competitive in agentic orchestration, quality gates must map to live reliability outcomes:

- **Task Success SLO:** Rolling 7-day autonomous task success rate target with explicit exclusions.
- **Safety SLO:** Zero unauthorized protected-scope writes; all violations are Sev-0 events.
- **Regression SLO:** Bounded post-merge regression rate with automatic rollback when threshold is exceeded.
- **Recovery SLO:** Maximum rollback completion time objective and verified rollback drills.
- **Latency SLO:** p50/p95/p99 targets for orchestration cycle stages (route, plan, execute, verify).
- **Observability SLO:** 100% traceability for autonomous actions from proposal to deployment decision.

## 🔐 Model and Supply-Chain Governance

Future readiness requires governance beyond runtime permissions:

- **Model Version Control:** Pin model versions per critical workflow, with explicit upgrade and rollback playbooks.
- **Prompt and Policy Versioning:** Every production prompt/policy change is versioned, reviewed, and tied to evaluation evidence.
- **Artifact Provenance:** Build and deploy artifacts must be attributable to source, actor, and pipeline run.
- **Dependency Trust:** Enforce dependency policy (license, CVE threshold, provenance) before deployment.
- **Evaluation Cadence:** Run scheduled benchmark suites for quality, safety, and multilingual parity, not only per-change checks.