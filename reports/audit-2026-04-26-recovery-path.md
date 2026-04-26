# Audit Report: Perspective E: Recovery Path - 2026-04-26

## 🎯 Objective

Verify the "Recovery Path" (Perspective E: Shield -> Spine -> Brain), focusing on how the system detects failures, triggers automatic rollbacks, and communicates recovery status back to the user/Brain.

## 🎯 Finding Type

- Bug
- Vulnerability
- Anti-Pattern

## 🔍 Investigation Path

- Started at: `docs/governance/AUDIT.md` and `docs/governance/ANTI-PATTERNS.md`.
- Selected Perspective E: Recovery Path.
- Examined Shield: `core/handlers/recovery.ts` (Dead Man's Switch), `core/lib/safety/circuit-breaker.ts`.
- Examined Spine: `infra/deployer.ts`, `buildspec.yml`.
- Examined Feedback Loop: `core/handlers/monitor.ts`, `core/handlers/health.ts`.
- Observed: Several race conditions and timing issues in the recovery flow.

## 🚨 Findings

| ID  | Title | Type | Severity | Location | Recommended Action |
| :-- | :--- | :--- | :------- | :------- | :----------------- |
| 1 | Premature Post-Recovery Warmup | Vulnerability | P1 | `core/handlers/recovery.ts:316` | Trigger warmup *after* CodeBuild build success in `monitor.ts` instead of immediately after starting the build. |
| 2 | Missing Feedback Loop for Recovery Success | Bug | P1 | `core/handlers/monitor.ts` | Specifically handle `EMERGENCY_ROLLBACK` builds in `monitor.ts` to reset recovery counters and notify Brain of restoration. |
| 3 | Non-Atomic Collaboration Creation | Anti-Pattern | P2 | `core/lib/memory/collaboration-operations.ts:98` | Use DynamoDB TransactWriteItems to atomically create collaboration and all participant indexes. |
| 4 | Unauthorized Agent Invitation (Principle 14) | Bug | P2 | `core/lib/memory/collaboration-operations.ts:133` | Verify `enabled === true` for agents before adding them as participants. |
| 5 | Shared Session Race in Collaboration | Bug | P2 | `core/lib/memory/collaboration-operations.ts:25` | Add a check/lock to ensure a `sessionId` is not already associated with another active collaboration. |

## 💡 Architectural Reflections

### The Recovery Feedback Gap
The current recovery flow is "fire and forget" from the perspective of the `recovery.handler`. It starts a CodeBuild job and then exits. While `monitor.ts` tracks build results, it does not distinguish between a regular feature deployment and a critical emergency rollback. 

Because `monitor.ts` doesn't "know" it's a recovery build, it doesn't perform high-integrity validation or reset system-wide recovery counters. This leads to a situation where the system can recover but still think it's in a failure state (`recoveryAttemptCount` never reset unless `make verify` succeeds and calls `/health`).

### Premature Warmup
Triggering `smartWarmup` immediately after `codebuild.send` is a race condition where we are warming up the *current broken versions* of Lambdas instead of the *recovered LKG versions*. This wastes resources and fails to provide the intended latency protection for the recovered system.

**Related Anti-Patterns**: 
- **Non-Atomic Operations (#11)**: Index creation for collaborations is decoupled from the main record, leading to potential data orphans.
- **Missing Enabled Check (#10)**: Principle 14 (Selection Integrity) is bypassed during collaboration invitation.
