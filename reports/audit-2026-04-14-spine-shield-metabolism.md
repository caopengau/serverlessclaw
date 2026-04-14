# Audit Report: Spine, Shield & Metabolism - 2026-04-14

## 🎯 Objective

Deep-dive into the system's vertical architecture, focusing on the asynchronous backbone (**The Spine**), security guardrails (**The Shield**), and autonomous repair mechanisms (**The Metabolism**), to identify functional bugs, architectural gaps, and state inconsistencies.

## 🎯 Finding Type

- **Bug**: Critical functional failures in security and locking logic.
- **Gap**: Missing implementation of documented architectural principles.
- **Inconsistency**: Divergent patterns across adapters and handlers.

## 🔍 Investigation Path

- **The Spine**: Analyzed `core/handlers/webhook.ts`, `core/handlers/maintenance.ts`, `core/lib/routing/AgentRouter.ts`, and `core/lib/recursion-tracker.ts`.
- **The Shield**: Evaluated `core/lib/safety/safety-engine.ts` and `core/lib/safety/blast-radius-store.ts`.
- **The Metabolism**: Reviewed `core/lib/maintenance/metabolism.ts` and its interaction with `AgentRegistry.ts`.
- **Cross-Silo**: Verified trust calibration flow from `CognitiveHealthMonitor` (Eye) to `TrustManager` (Scales).

## 🚨 Findings

| ID  | Title | Type | Severity | Location | Recommended Action |
| :-- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Blast Radius Limit Bypass** | Bug | **P0** | `blast-radius-store.ts:74` | Wrap `UpdateExpression` fields in `value` field to match `ConfigTable` schema. |
| 2 | **Incorrect Lock Boundary in Webhook** | Bug | **P1** | `webhook.ts:181` | Use `sessionId` instead of `chatId` (userId) for `acquireProcessing` to prevent cross-session races. |
| 3 | **Unenforced Facilitator Tie-break Threshold** | Gap | **P1** | `maintenance.ts:145` | Verify `TrustScore >= 90` for the Facilitator before emitting `STRATEGIC_TIE_BREAK`. |
| 4 | **Telegram-Hardcoded Smart Warm-up** | Bug | **P2** | `webhook.ts:51` | Refactor warm-up target identification to be adapter-agnostic (use normalized `inbound` data). |
| 5 | **Ineffective Remediation Strategy** | Gap | **P2** | `metabolism.ts:133` | Strategy 1 fails for failing tools with >0 executions. Add logic to prune specific failing overrides. |
| 6 | **Unused Facilitator Threshold Constant** | Gap | **P3** | `constants/system.ts:120` | Implement the threshold check in `StrategicTieBreakHandler`. |

## 🛠️ Detailed Analysis

### 1. [P0] Blast Radius Security Bypass
The `BlastRadiusStore.incrementBlastRadius` method uses an atomic `UpdateCommand` that sets `count`, `lastAction`, and `expiresAt` at the **top level** of the DynamoDB item. However, the system's `ConfigTable` pattern (enforced by `ConfigManager` and `getBlastRadius`) expects these fields to be wrapped in a `value` object. 
- **Impact**: `getBlastRadius` always returns `null` because `Item.value` is missing, causing `canExecute` to always return `allowed: true`, effectively disabling the 5-per-hour Class C action limit.

### 2. [P1] Webhook Lock Contention & Race
`webhook.ts` acquires a session lock using `chatId` (which defaults to `userId`). 
- **Impact**: For adapters like Jira where one user may have multiple concurrent issues (different `sessionId`s), these issues will block each other unnecessarily. Conversely, if multiple users edit the same issue (same `sessionId`), they will **not** block each other, leading to corrupted session state.

### 3. [P1] Facilitator Trust Integrity Gap
Principle 12 explicitly mandates a `TrustScore >= 90` for Facilitators to perform autonomous tie-breaks.
- **Impact**: `maintenance.ts` and `StrategicTieBreakHandler` currently bypass this check, allowing low-trust facilitators to make strategic decisions during stale collaboration resolution.

## 💡 Architectural Reflections

While the core logic for **Atomic Recursion Guards** and **Distributed Locking** is robustly implemented in the library layer, the **Handler Layer** (`webhook.ts`, `maintenance.ts`) shows signs of "Platform Drift" where Telegram-centric assumptions or simplified locking boundaries create vulnerabilities. The **Metabolism** silo is a strong foundation but requires more surgical remediation strategies beyond broad registry pruning to truly fulfill its regenerative mission.

## ✅ Verification Checklist
- [ ] Fix `BlastRadiusStore` DynamoDB schema alignment.
- [ ] Standardize `webhook.ts` locking on `sessionId`.
- [ ] Implement `FACILITATOR_THRESHOLD` check in `maintenance.ts`.
- [ ] Generalize `WarmupManager` input in `webhook.ts`.
