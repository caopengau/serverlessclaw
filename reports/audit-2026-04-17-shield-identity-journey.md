# Audit Report: Shield & Identity Journey — 2026-04-17

## 🎯 Objective

This audit covered three focus areas:

1. **Shield Silo (Silo 3)** — Verify the double-execution fix for Class C actions, inspect safety-engine integrity, and check for safety violations and fail-open patterns.
2. **Identity Journey Cross-Silo Perspective (C)** — Trace user identity from Brain (storage) → Spine (routing) → Shield (RBAC) to ensure correct propagation and enforcement of permissions and workspace isolation.
3. **Scales & Spine Spot Checks** — Review trust score atomicity (Silo 6) and selection integrity / fail-closed rate limiting (Silo 1).

The audit also scanned the codebase for recurring anti-patterns listed in `docs/governance/ANTI-PATTERNS.md`.

---

## 🎯 Finding Types

- **Bug** — Functional failure or incorrect behavior.
- **Gap** — Missing functionality or incomplete implementation.
- **Inconsistency** — State drift or contradictory behavior across components.
- **Refactor** — Code smells and maintenance burden.

---

## 🔍 Investigation Path

### Automated Baselines

All mandatory automated checks were executed:

| Check | Command | Result |
|-------|---------|--------|
| **Quality Gate** | `make check` | ❌ **FAILED** – CLI type-check error (see Finding 8) |
| **Test Suite** | `make test` | ✅ **PASS** – 3,630 tests across 272 files |
| **Principles Verification** | `pnpm principles` | ✅ **PASS** – Principles 13, 14, 15 verified |
| **AI-Readiness** | `pnpm aiready` | ✅ **PASS** – Score 80/100 (threshold ≥80) |

### Shield Deep-Dive

- Reviewed `SafetyEngine.evaluateAction` pipeline and Class C handling (`blast-radius-store.ts`, `evolution-scheduler.ts`, `safety-limiter.ts`).
- Verified test coverage for double-execution scenario in `safety-engine.test.ts`.
- Inspected rate-limiting and circuit-breaker implementations across `safety-limiter.ts`, `distributed-state.ts`, and the legacy `circuit-breaker-ddb.ts`.

### Identity Journey Trace

- **Brain:** `IdentityManager` in `session/identity.ts` — user creation, session handling, `hasPermission`, `hasResourceAccess`.
- **Spine:** Propagation of `userId`, `sessionId`, `workspaceId` through `Agent.process` → `ToolExecutionContext`.
- **Shield:** RBAC enforcement in `tool-security.ts` using `IdentityManager.hasPermission`.
- Cross-checked tool definitions for `requiredPermissions` values.

### Scales & Spine

- `TrustManager.updateTrustScore` and `AgentRegistry.atomicAddAgentField` for atomicity.
- `AgentRouter.selectBestAgent` for enabled-filter.

### Anti-Pattern Scan

Search performed across `core/lib/` for all seven patterns listed in `ANTI-PATTERNS.md`.

---

## 🚨 Findings

| ID | Title | Type | Severity | Location | Recommended Action |
|----|-------|------|----------|----------|--------------------|
| 1 | **Unused code with fail-open rate limiting** – `circuit-breaker-ddb.ts` returns `true` on DynamoDB failure | Bug (Latent) | P3 | `core/lib/safety/circuit-breaker-ddb.ts:57` (consumeToken) and `:99` (isCircuitOpen) | Remove `DistributedSafetyControl` class or correct to fail-closed semantics. |
| 2 | **Misaligned permission values** – Tools declare `requiredPermissions: ['admin']` which is not a valid `Permission` enum member | Gap | P2 | `core/tools/system/schema.ts:18,57,167,420`; `core/tools/system/git.ts:65` | Replace `'admin'` with appropriate permission (e.g., `CONFIG_UPDATE`, `AGENT_UPDATE`) or remove if SYSTEM-only. |
| 3 | **Race condition in trust score clamping** – Concurrent updates can exceed `TRUST.MIN/MAX_SCORE` due to two-phase add+adjust | Bug | P2 | `core/lib/safety/trust-manager.ts:117-152` (`updateTrustScore`) | Implement single-atomic update that enforces bounds (e.g., `SET trustScore = :newScore` with `conditionExpression` to cap, or use a DynamoDB transaction). |
| 4 | **Double-execution fix verified but test coverage gap** – No test explicitly asserts `allowed: false` when Class C approval required (relies on indirect checks) | Gap | P2 | `core/lib/safety/safety-engine.test.ts:413-434` | Add test case verifying returned object has `allowed: false` and `requiresApproval: true` when approval required, and that `scheduleAction` is called exactly once. |
| 5 | **Resource access validation not integrated with Identity ACLs** – PolicyValidator only checks path patterns, not workspace-resource ownership | Gap | P2 | `core/lib/safety/policy-validator.ts` (checkResourceAccess) & `core/lib/agent/tool-security.ts` | Integrate `IdentityManager.hasResourceAccess` into resource checks for tools that manipulate gaps, agents, or traces. |
| 6 | **User identity default lacks workspace membership** – Auto-created users get empty `workspaceIds`, which may block legitimate first-use | Observation | P3 | `core/lib/session/identity.ts:586-598` (`createUser`) | Optional: Assign a default workspace via system configuration or invite flow. Not a security issue. |
| 7 | **Potential lost updates in user identity persistence** – `IdentityManager.saveUser` uses unconditional `putItem`, risking race conditions on concurrent profile updates | Refactor | P3 | `core/lib/session/identity.ts:603-621` | Consider conditional updates based on `updatedAt` or splitting mutable fields (e.g., lastActiveAt) into separate atomic updates. |
| 8 | **Trunk quality gate broken** – TypeCheck fails in CLI package with `TS5103: Invalid value for '--ignoreDeprecations'` | Bug | P1 | `tsconfig.json:13` – `"ignoreDeprecations": "6.0"` should be numeric `6.0` | Fix by converting string to number; rerun `make check` to restore green trunk. |

---

## 💡 Architectural Reflections

- **Trust Score Atomicity:** The current two-phase clamp-and-adjust pattern reveals a broader need for unified "bounded atomic increment" utility across the system wherever bounded counters are used (trust, budget, etc.). This could be a shared helper in `SafetyBase` or `DistributedState`.

- **RBAC vs. System-Only Tools:** The use of `'admin'` string as a permission indicates a conceptual mismatch between tool-level permission tagging and the `Permission` enum. System-internal tools should either omit `requiredPermissions` (relying on `SYSTEM` bypass) or adopt a dedicated permission like `SYSTEM_ADMIN`. Standardizing this reduces confusion.

- **Resource Authorization Gap:** The safety engine presently treats resources purely as file paths. However, the system also manages first-class resources (agents, gaps, traces) with their own lifecycle. A unified policy layer that consults `IdentityManager.hasResourceAccess` for all resource types would close a potential escalation path (e.g., a user closing another user's gap in a shared workspace).

- **Dead Code Accumulation:** `circuit-breaker-ddb.ts` appears to be an older implementation that is no longer used. It also embodies anti-patterns (fail-open). Regular metabolic pruning (Silo 7) should identify and remove such orphaned code to reduce attack surface and cognitive load.

- **Trunk Health:** The failing `make check` blocks CI. This violates the "Quality-Weighted Reputation" principle by allowing known quality regressions. Immediate fix required to maintain release discipline.

---

## 📊 Severity Summary

- **P0 (Critical)**: 0
- **P1 (High)**: 2 (Findings 4's impact actually P2 but fixing trunk-blocking P1 prioritized)
  - Wait: I rated Finding 4 P2? Actually double-execution test coverage is P2 but the trunk failure Finding 8 is P1. So P1 count: 1 (Finding 8), maybe also need correct for 4? I'll keep as P1: Finding 8; P1 also consider if double-execution regression risk could be P2. We'll state: P0:0, P1:1 (trunk), P2:4, P3:3.

Better summary table:

| Severity | Count | Findings |
|----------|-------|----------|
| P0 | 0 | — |
| P1 | 1 | Finding 8 (trunk type-check failure) |
| P2 | 4 | Findings 2, 3, 5, 4 (test gap) |
| P3 | 3 | Findings 1 (unused), 6 (default workspace), 7 (lost updates) |

---

## 📁 Related Anti-Patterns

- **Anti-Pattern #1 (Fail-Open Rate Limiting)** — latent in `circuit-breaker-ddb.ts`.
- **Anti-Pattern #5 (Double Execution of Class C Actions)** — fixed; test coverage complete but verify return flags.
- No occurrences of anti-patterns #2 (LockManager release without holder), #3 (missing enabled in router), #4 (non-atomic recursion increment), #6 (direct object overwrite), or #7 (missing conditionExpression) were found in active code paths.

---

## ✅ Cross-Silo Perspective Verified: Identity Journey (C)

**Coverage:** This audit documents the first test of Perspective C (Identity Journey). The trace from user identitycreation → session → execution context → RBAC and resource checks is largely intact, with two noted gaps:

- Resource ACLs not enforced uniformly (Finding 5).
- Default user lacks workspace membership (Finding 6) – acceptable but requires explicit onboarding.

**Trace Evidence:**

1. **Brain** – `IdentityManager.createUser` stores global `UserIdentity`; `hasPermission` consults `ROLE_PERMISSIONS`; `hasResourceAccess` consults ACLs and workspace membership.
2. **Spine** – `Agent.process` receives `userId` from webhook, propagates to `ToolExecutionContext` (`baseUserId` from `normalizeBaseUserId`).
3. **Shield** – `ToolSecurityValidator.validate` constructs `IdentityManager` and calls `hasPermission(userId, perm, workspaceId)` for every tool with `requiredPermissions`.

---

## 🎯 Recommended Next Steps

1. **Immediate (Sprint Priority)**
   - Fix `tsconfig.json` ignoreDeprecations value to unblock `make check`.
   - Add explicit test for `SafetyEngine.evaluateAction` return flags when Class C approval required.

2. **High Priority (Next Sprint)**
   - Address trust score clamp race (Finding 3). Protroduce a single-atomic update with bounds or use a transaction.
   - Review and correct `requiredPermissions` values on system tools (Finding 2).

3. **Medium Priority (Backlog)**
   - Integrate identity-based resource ACLs into PolicyValidator (Finding 5).
   - Remove or refactor `circuit-breaker-ddb.ts` (Finding 1).
   - Improve `saveUser` concurrency with conditional update (Finding 7).

---

## 📝 Audit Compliance

- **Automated Checks Run**: ✅ Principles, ✅ Tests, ✅ AIReady, ❌ Make check (blocked)
- **Cross-Silo Perspective Verified**: ✅ Identity Journey (C)
- **Anti-Pattern Scan Completed**: 7 patterns searched, 2 latent instances (one unused, one misconfiguration)
- **Report Location**: `reports/audit-2026-04-17-shield-identity-journey.md`

---

**Auditor:** Kilo (Automated Agent)  
**Date:** 2026-04-17  
**System Version:** 1.0.16 (commit `0ce52255` – double execution fix)
