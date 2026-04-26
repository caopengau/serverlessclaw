# Audit Report: The Shield & Recovery Path - 2026-04-22

## 🎯 Objective

Audited **Silo 3 (The Shield)** through the lens of **Perspective E: Recovery Path (Shield → Spine → Brain)**. The goal was to verify that when an action is blocked or requires human approval, the system maintains consistency, preserves intent, and allows for safe recovery or human intervention.

## 🎯 Finding Type

- Bug / Gap / Inconsistency

## 🔍 Investigation Path

- Started at: `core/lib/safety/safety-engine.ts` (specifically `handleClassCAction`).
- Followed: The scheduling of pending Class C actions into `core/lib/safety/evolution-scheduler.ts` and the timeout execution path via `core/handlers/events/strategic-tie-break-handler.ts`.
- Observed: 
  1. The API to approve/reject `PENDING_EVOLUTION` actions does not exist in the Dashboard APIs. 
  2. The `EvolutionScheduler.scheduleAction` method discards the actual tool arguments and preserves only the `action` (e.g., "code_change") and `reason`.
  3. Upon timeout, `triggerProactiveEvolution` blindly emits a `STRATEGIC_TIE_BREAK` event with malformed payload (missing `originalTask`), causing the tie-break handler to either crash or process an undefined task risk assessment, and ultimately just emitting a text prompt ("Proactive evolution for: ...") instead of executing the intended tool.
  4. Missing workspace validation in the `updateStatus` method of `EvolutionScheduler` allows unauthorized cross-tenant approvals if an actionId is known or guessed.

## 🚨 Findings

| ID | Title | Type | Severity | Location | Recommended Action |
|:---|:------|:-----|:---------|:---------|:-------------------|
| 1 | **Missing Approval API Endpoint** | Gap | P1 | `dashboard/src/app/api/` | Create a secured API endpoint for users to approve/reject pending Class C actions via `updateStatus`. |
| 2 | **Tool Execution Context Dropped** | Bug | P0 | `core/lib/safety/evolution-scheduler.ts` | Update `scheduleAction` and `PendingEvolution` interface to capture and persist the exact `toolName` and `args` of the blocked tool call. |
| 3 | **Timeout Recovery Crash & Data Loss** | Bug | P1 | `core/handlers/events/strategic-tie-break-handler.ts` | Pass the complete execution context upon timeout. Fix the `originalTask` undefined reference causing the risk assessment regex to fail. |
| 4 | **Cross-Tenant IDOR on Approval** | Bug | P0 | `core/lib/safety/evolution-scheduler.ts:171` | Add `workspaceId` checks into `updateStatus` to prevent cross-tenant approval of pending Class C actions. |

## 💡 Architectural Reflections

The fundamental disconnect between **The Shield** (blocking actions) and **The Spine** (handling the recovery) creates a dangerous false sense of security. The "proactive evolution" mechanism currently operates on generic text descriptions instead of structured, executable tool contexts. This breaks Principle 15 (Monotonic Progress) because the system forgets the actual solution it synthesized, reverting to an unrecoverable state while reporting it as an "Evolution". The Human-in-the-Loop (HITL) architecture cannot function if the loop lacks an accessible interface and drops the critical context needed to act upon approval.