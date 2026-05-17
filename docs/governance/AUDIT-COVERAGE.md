# Audit Coverage Matrix

## Overview

This document tracks which system silos and cross-silo perspectives have been audited across all rounds. It helps identify under-audited areas and guide future audit efforts.

Last Updated: 2026-05-14

---

## Silo Coverage (1-7)

| Silo  | Name           | Primary Code Paths                              | Audit Count | Last Audited | Risk Level |
| :---- | :------------- | :---------------------------------------------- | :---------- | :----------- | :--------- |
| **1** | The Spine      | `core/handlers/events.ts`, `core/lib/bus.ts`    | 28          | 2026-05-17   | Low        |
| **2** | The Hand       | `core/lib/mcp.ts`, `core/lib/agent/executor.ts` | 17          | 2026-05-17   | Low        |
| **3** | The Shield     | `core/lib/safety/safety-engine.ts`              | 26          | 2026-05-16   | Low        |
| **4** | The Brain      | `core/lib/memory/`, `core/lib/rag/`             | 25          | 2026-05-17   | Low        |
| **5** | The Eye        | `core/lib/metrics/`, `core/lib/tracer/`         | 22          | 2026-05-17   | Low        |
| **6** | The Scales     | `core/lib/safety/trust-manager.ts`              | 22          | 2026-05-17   | Low        |
| **7** | The Metabolism | `core/lib/maintenance/metabolism.ts`            | 20          | 2026-05-17   | Low        |

---

## Cross-Silo Perspectives (A-F) Coverage

| Perspective | Name              | Description                 | Usage Count | Last Tested |
| :---------- | :---------------- | :-------------------------- | :---------- | :---------- |
| **A**       | Life of a Message | Spine → Brain → Eye         | 12          | 2026-05-12  |
| **B**       | Evolution Cycle   | Hand → Shield → Scales      | 13          | 2026-05-14  |
| **C**       | Identity Journey  | Brain → Spine → Shield      | 12          | 2026-05-12  |
| **D**       | Trust Loop        | Eye → Scales → Spine        | 16          | 2026-05-14  |
| **E**       | Recovery Path     | Shield → Spine → Brain      | 15          | 2026-05-16  |
| **F**       | Metabolic Loop    | Metabolism ↔ Scales ↔ Spine | 11          | 2026-05-16  |
| **G**       | Dashboard Integrity| Cross-Silo API Safety      | 3           | 2026-05-16  |

---

## Audit Reports History

| Date       | Report                                             | Silos                            | Perspective | Status/Summary                                                                                                        |
| :--------- | :------------------------------------------------- | :------------------------------- | :---------- | :-------------------------------------------------------------------------------------------------------------------- |
| 2026-05-17 | `reports/audit-2026-05-17-evolution-telemetry.md`       | Spine, Hand, Eye, Scales, Metabolism | B, D, F | FIXED: P0 Telemetry Blindness in Trust/Memory/Metabolism, P1 Race in Session Handoff, P1 Domain Pollution in Audit. |
| 2026-05-16 | `reports/audit-2026-05-16-safety-isolation.md`          | Hand, Shield, Scales, Spine      | E           | FIXED: P0 Multi-tenant Leak in SafetyEngine, P1 Metabolic Blindness in Safety/Blast caches. Verified Recovery. |
| 2026-05-16 | `reports/audit-2026-05-16-dashboard-metabolism.md`         | Spine, Brain, Eye, Metabolism    | F, G        | FIXED: P0 Dashboard Trace Leak, P1 Anti-Pattern 19 in Dashboard/API, P1 Metabolic Blindness in Maintenance Handler.   |
| 2026-05-14 | `reports/audit-2026-05-14-hand-metabolism-pollution.md`    | Hand, Metabolism, Eye            | B, G        | FIXED: P1 Domain Pollution in Core Framework, P1 Multi-tenant leak in Dashboard Trace/Memory pages, P2 Infra Branding.|
| 2026-05-14 | `reports/audit-2026-05-14-dashboard-isolation.md`          | Spine, Brain, Eye                | D, G        | FIXED: Critical Multi-tenant isolation in 10+ Dashboard APIs, P1 Trace Purge leak, P1 Aggregated metrics leakage.     |
| 2026-05-13 | `reports/audit-2026-05-13-spine-brain.md`                | Spine, Brain                    | C, F        | FIXED: P1 AP-19 in Memory Fetcher/DLQ/Sessions, P1 Race in Workspace Management, P2 Identity Race.                    |
| 2026-05-13 | `reports/audit-2026-05-13-shield-scales.md`               | Shield, Scales                  | E, B        | FIXED: P1 Multi-tenant leak in Cognitive Tool, P2 Leak in Blast Radius Stats, P2 Monitor Anomaly leakage.             |
| 2026-05-13 | `reports/audit-2026-05-13-hand-metabolism.md`              | Hand, Metabolism                 | B, F        | FIXED: P1 Missing WS Scoping in MCP Audit, P1 Global Circuit Breaker ambiguity, P2 Domain Pollution in Framework Sync.|
| 2026-05-13 | `reports/audit-2026-05-13-eye-telemetry.md`                | Eye                              | D           | FIXED: P1 Anti-Pattern 19 (In-Memory filtering), P1 Missing WS Scoping, P2 Domain Pollution in metrics.               |
| 2026-05-12 | `reports/audit-2026-05-12-brain-identity.md`               | Brain                            | C           | FIXED: P1 Anti-Pattern 19 (In-Memory filtering) in 3 areas, P1 Principle 13 (Atomic Updates) in 9 files.              |
| 2026-05-12 | `reports/audit-2026-05-12-hand-evolution.md`        | Hand                             | B           | FIXED: P1 Hub routing context propagation, P2 Static map memory leaks (Anti-Pattern 19), Verified Tool Security.      |
| 2026-05-12 | `reports/audit-2026-05-12-brain-metabolism.md`             | Brain, Metabolism                | A, F        | FIXED: P1 Millisecond message collisions, P1 DLQ telemetry scoping, Verified Atomic Persistence.                     |
| 2026-05-12 | `reports/audit-2026-05-12-shield-recovery.md`              | Shield                           | E           | FIXED: P1 Cross-Tenant Leak in Loop Detector, P1 Alerting Blindness in Dead Mans Switch. Verified IAM.                |
| 2026-05-12 | `reports/audit-2026-05-12-scales-evolution.md`             | Scales                           | B           | FIXED: P1 Missing Atomic Sync for Inferred Gap IDs in Deployment. Verified TrustManager and PromotionManager.         |
| 2026-05-12 | `reports/audit-2026-05-12-spine-metabolic-loop.md`         | Spine, Metabolism                | F           | FIXED: P1 Tenant-blind Config Load, P1 Multi-tenant Leakage in Event DLQ Routing, P2 Trace Summaries Global Flag.     |
| 2026-05-11 | `reports/audit-2026-05-11-tool-execution.md`               | Hand, Metabolism                 | B, D, F     | FIXED: Non-atomic MCP server registration, Race condition in default server discovery. Verified cost/budget.          |
| 2026-05-11 | `reports/audit-2026-05-11-metabolism-hardening.md`         | Metabolism                       | F           | FIXED: P2 Telemetry blindness, P1 CLI gate blocker, P1 Script duplication.                                            |
| 2026-05-09 | `reports/audit-2026-05-09-spine.md`                        | Spine                            | A           | FIXED: P1 DLQ Retrieval Leakage, P1 Event Routing Override failure, P2 Health Reporting scoping gap, P2 Flow Control. |
| 2026-05-09 | `reports/audit-2026-05-09-metabolism-loop.md`              | Metabolism, Scales, Spine        | F           | FIXED: P1 Global Circuit Breaker (Multi-Tenant DoS), P2 Budget reporting leakage, P3 Principles checker gap.          |
| 2026-05-09 | `reports/audit-2026-05-09-shield-recovery.md`              | Shield                           | E           | FIXED: P1 Global Circuit Breaker (Multi-Tenant DoS), P1 Global Deploy Stats leakage, P2 Principles Checker gap.       |
| 2026-05-09 | `reports/audit-2026-05-09-brain-isolation.md`              | Brain                            | C           | FIXED: P1 Starvation in memory queries due to in-memory filtering (Anti-Pattern 19).                                  |
| 2026-05-04 | `reports/audit-2026-05-04-metabolism-loop.md`              | Metabolism, Scales, Spine        | F           | FIXED: P1 Metabolic Memory Leak (Gaps), P2 Redundant Mode Shifting, P2 Promotion Race Condition, P2 S3 Isolation.     |


---

## Gap Analysis

### High Priority (Needs Re-Audit)

1. **None at this time.** (Silo 4 vector store was audited and confirmed as a future milestone gap).

### Medium Priority (Rarely Audited)

1. **None at this time.** (Silo 2 Hand tool acquisition cost verified).

---

### High Risk (Most Violations)

1. **All core silos (1-7) have been significantly hardened as of 2026-05-01.** Risk levels have been downgraded based on comprehensive remediation of cross-silo leaks, race conditions, and cognitive safety gaps.

---

## Audit Best Practices for Future Agents

1. **Principle 13/15 First**: Prioritize checking `ConditionExpression` and `ADD` patterns in DynamoDB.
2. **Multi-Tenancy Scoping**: Verify `workspaceId` propagation in all cross-silo events.
3. **Automated Verification**: Always run `pnpm principles` and update the rule list in `scripts/quality/verify-principles.ts` to include new patterns.
4. **Track Recurrence**: Use `ANTI-PATTERNS.md` to prevent regression of fixed P1 issues.

---

## Anti-Patterns Identified

See `docs/governance/ANTI-PATTERNS.md` for recurring issues to avoid.
