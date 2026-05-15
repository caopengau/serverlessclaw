# Architecture: Evals & Fine-Tuning Pipelines

> **Navigation**: [← Index Hub](../../INDEX.md)

This document outlines the strategic architecture for Integrated Quantitative Evals (The SONA Loop) and Specialized Fine-Tuning Pipelines within ServerlessClaw.

## 1. Core Philosophy: Cost-Effective Evolution (May 2026)

ServerlessClaw operates in an era where intelligence is a commodity but operational cost dictates scalability. 
Our primary reasoning engines for continuous operations, evals, and background tasks are **DeepSeek V4 Flash** and **MiniMax m2.7**. These models provide the optimal balance of reasoning density and cost-efficiency required for an always-on, self-evolving system.

## 2. Integrated Quantitative Evals (TDAD)

We employ **Test-Driven Agent Development (TDAD)** to ensure the swarm's capabilities monotonically increase.

### The CI/CD Evals Suite
- **Cognitive Benchmarks:** A suite of "Gold Standard" tasks (e.g., component refactoring, security flaw identification, tool usage efficiency) stored within the repository.
- **The Guardrail:** Before the `QA Auditor` or `PromotionManager` graduates a new capability or merges autonomous code, the `claw eval` suite is triggered in an isolated environment.
- **LLM-as-a-Judge:** A high-tier model (e.g., Claude 3.5 Sonnet or GPT-4o) evaluates the traces of the primary operating models (DeepSeek/MiniMax) against strict rubrics.
- **Circuit Breaker:** If the `EvalScore` drops below the historical moving average for that domain, the deployment is rejected, and a `FAILED_PLAN#` is logged to Negative Memory.

## 3. Specialized Fine-Tuning Pipelines

Instead of relying solely on prompt engineering, ServerlessClaw autonomously curates its own training data to build highly specialized expert models.

### Automated S3 Curation
1. **Trace Ingestion:** The `ClawTracer` and `TokenTracker` constantly monitor agent execution.
2. **Quality Filtering:** Traces that hit specific quality thresholds (e.g., `TrustScore > 95`, `0 Errors`, `Tokens < Target Budget`) are automatically sanitized (PII removal, workspace decoupling) and exported to a secure S3 Data Lake in `JSONL` format.
3. **The Curation Queue:** These traces are not immediately trained on; they enter a "Review Queue" for Human-in-the-Loop (HITL) approval.
4. **Triggering:** Once a critical mass of verified traces is accumulated for a specific skill (e.g., "SST Infra Migration"), the dashboard can trigger an automated Fine-Tuning job via AWS Bedrock or OpenAI.

## 4. The Neural Playground & Tuning Dashboard

To support human-agent collaboration and maintain oversight over the evolution process, the ClawCenter Dashboard includes a specialized **Neural Playground / Tuning Ground** sector.

### Features
- **Performance Telemetry:** Visual graphs displaying the `EvalScore`, Token Cost, and Latency (p50/p95) of each agent and model over a 30-day window.
- **Simulation Environment:** A sandbox where commanders can manually dispatch a "Test Mission" to a specific agent and watch its reasoning trace live, without affecting the production `MemoryTable`.
- **Review Queue UI:** An interactive interface for humans to approve, edit, or reject curated traces before they are sent to the fine-tuning pipeline.

### SuperClaw Collaboration Tools
SuperClaw acts as the facilitator for the tuning process. It is equipped with advanced UI rendering tools to bridge the gap between agent logic and human oversight:
- **`renderTuningQueue` (Proposed):** Allows SuperClaw to directly surface pending high-quality traces in the chat interface for quick human approval.
- **`renderPlanEditor` / `renderCodeDiff`:** Utilized during the Eval review process to show humans exactly where an agent succeeded or failed against the baseline.
- **`seekClarification`:** Actively used by the system if the LLM-as-a-Judge returns an ambiguous score, allowing the human commander to provide the final verdict.

## 5. Implementation Roadmap

1. **Phase A:** Extend `TokenTracker` and `ClawTracer` to write to the S3 Data Lake (JSONL).
2. **Phase B:** Build the `claw eval` CLI harness and integrate LLM-as-a-judge scoring.
3. **Phase C:** Develop the Tuning Ground Dashboard sector.
4. **Phase D:** Integrate Bedrock/OpenAI fine-tuning API triggers.
