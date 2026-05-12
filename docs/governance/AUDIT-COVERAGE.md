# Audit Coverage Matrix

## Overview

This document tracks which system silos and cross-silo perspectives have been audited across all rounds. It helps identify under-audited areas and guide future audit efforts.

Last Updated: 2026-05-12

---

## Silo Coverage (1-7)

| Silo  | Name           | Primary Code Paths                              | Audit Count | Last Audited | Risk Level |
| :---- | :------------- | :---------------------------------------------- | :---------- | :----------- | :--------- |
| **1** | The Spine      | `core/handlers/events.ts`, `core/lib/bus.ts`    | 24          | 2026-05-12   | Low        |
| **2** | The Hand       | `core/lib/mcp.ts`, `core/lib/agent/executor.ts` | 13          | 2026-05-11   | Low        |
| **3** | The Shield     | `core/lib/safety/safety-engine.ts`              | 23          | 2026-05-12   | Low        |
| **4** | The Brain      | `core/lib/memory/`, `core/lib/rag/`             | 20          | 2026-05-12   | Low        |
| **5** | The Eye        | `core/lib/metrics/`, `core/lib/tracer/`         | 18          | 2026-05-11   | Low        |
| **6** | The Scales     | `core/lib/safety/trust-manager.ts`              | 19          | 2026-05-12   | Low        |
| **7** | The Metabolism | `core/lib/maintenance/metabolism.ts`            | 16          | 2026-05-11   | Low        |

---

## Cross-Silo Perspectives (A-F) Coverage

| Perspective | Name              | Description                 | Usage Count | Last Tested |
| :---------- | :---------------- | :-------------------------- | :---------- | :---------- |
| **A**       | Life of a Message | Spine → Brain → Eye         | 11          | 2026-05-11  |
| **B**       | Evolution Cycle   | Hand → Shield → Scales      | 11          | 2026-05-12  |
| **C**       | Identity Journey  | Brain → Spine → Shield      | 12          | 2026-05-12  |
| **D**       | Trust Loop        | Eye → Scales → Spine        | 15          | 2026-05-12  |
| **E**       | Recovery Path     | Shield → Spine → Brain      | 14          | 2026-05-12  |
| **F**       | Metabolic Loop    | Metabolism ↔ Scales ↔ Spine | 9           | 2026-05-12  |

---

## Audit Reports History

| Date       | Report                                             | Silos                            | Perspective | Status/Summary                                                                                                        |
| :--------- | :------------------------------------------------- | :------------------------------- | :---------- | :-------------------------------------------------------------------------------------------------------------------- |
| 2026-05-12 | `audit-2026-05-12-brain-identity.md`               | Brain                            | C           | FIXED: P1 Anti-Pattern 19 (In-Memory filtering) in 3 areas, P1 Principle 13 (Atomic Updates) in 9 files.              |
| 2026-05-12 | `audit-2026-05-12-shield-recovery.md`              | Shield                           | E           | FIXED: P1 Cross-Tenant Leak in Loop Detector, P1 Alerting Blindness in Dead Mans Switch. Verified IAM.                |
| 2026-05-12 | `audit-2026-05-12-scales-evolution.md`             | Scales                           | B           | FIXED: P1 Missing Atomic Sync for Inferred Gap IDs in Deployment. Verified TrustManager and PromotionManager.         |
| 2026-05-12 | `audit-2026-05-12-spine-metabolic-loop.md`         | Spine, Metabolism                | F           | FIXED: P1 Tenant-blind Config Load, P1 Multi-tenant Leakage in Event DLQ Routing, P2 Trace Summaries Global Flag.     |
| 2026-05-11 | `audit-2026-05-11-tool-execution.md`               | Hand, Metabolism                 | B, D, F     | FIXED: Non-atomic MCP server registration, Race condition in default server discovery. Verified cost/budget.          |
| 2026-05-11 | `audit-2026-05-11-metabolism-hardening.md`         | Metabolism                       | F           | FIXED: P2 Telemetry blindness, P1 CLI gate blocker, P1 Script duplication.                                            |
| 2026-05-09 | `audit-2026-05-09-spine.md`                        | Spine                            | A           | FIXED: P1 DLQ Retrieval Leakage, P1 Event Routing Override failure, P2 Health Reporting scoping gap, P2 Flow Control. |
| 2026-05-09 | `audit-2026-05-09-metabolism-loop.md`              | Metabolism, Scales, Spine        | F           | FIXED: P1 Global Circuit Breaker (Multi-Tenant DoS), P2 Budget reporting leakage, P3 Principles checker gap.          |
| 2026-05-09 | `audit-2026-05-09-shield-recovery.md`              | Shield                           | E           | FIXED: P1 Global Circuit Breaker (Multi-Tenant DoS), P1 Global Deploy Stats leakage, P2 Principles Checker gap.       |
| 2026-05-09 | `audit-2026-05-09-brain-isolation.md`              | Brain                            | C           | FIXED: P1 Starvation in memory queries due to in-memory filtering (Anti-Pattern 19).                                  |
| 2026-05-04 | `audit-2026-05-04-metabolism-loop.md`              | Metabolism, Scales, Spine        | F           | FIXED: P1 Metabolic Memory Leak (Gaps), P2 Redundant Mode Shifting, P2 Promotion Race Condition, P2 S3 Isolation.     |

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
