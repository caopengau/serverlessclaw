# Audit Report: Shield & Scales - 2026-04-16

## 🎯 Objective

Deep dive into the Shield (SafetyEngine) and Scales (TrustManager) silos to identify bugs, gaps, inconsistencies, and opportunities to simplify and clean the system.

## 🎯 Finding Type

- Bug (Functional Failure)
- Inconsistency (State Drift)

## 🔍 Investigation Path

- Started at: `core/lib/safety/safety-engine.ts` (Silo 3: The Shield)
- Followed: The "Evolution Cycle" cross-silo perspective, specifically tracking how Class C actions with high TrustScore (Silo 6) transition to autonomous mode (Principle 9).
- Observed: A significant state drift/bug where autonomously promoted Class C actions were executed immediately *and* simultaneously scheduled for human review.

## 🚨 Findings

| ID  | Title                                                 | Type       | Severity | Location                                      | Recommended Action                                                                                         |
| :-- | :---------------------------------------------------- | :--------- | :------- | :-------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| 1   | Double-Execution of Promoted Class C Actions          | Bug        | P1       | `safety-engine.ts:190` (validateDynamic...)   | Reorder promotion checks to run *before* blast radius enforcement, and only schedule if approval is needed. |
| 2   | Unconditional Evolution Scheduling for Class C        | Bug        | P1       | `safety-engine.ts:285` (handleClassCAction)   | Condition the `evolutionScheduler.scheduleAction` on `approvalResult.requiresApproval`.                    |
| 3   | TrustScore Overwrite Race Condition during Clamping   | Refactor   | P3       | `trust-manager.ts:120` (updateTrustScore)     | Replace direct `atomicUpdateAgentField` clamping with a native conditional update to avoid race condition.  |

## 💡 Architectural Reflections

### The Shield / Scales Bridge
The interaction between the Shield (Safety Gate) and Scales (Trust Management) was leaking state. When Principle 9 (Trust-Driven Mode Shifting) was triggered, the safety engine permitted the action (`allowed: true`) but the previous synchronous step had *already* pushed the action to the `EvolutionScheduler`. This meant an agent that "earned" its autonomy would actually trigger a double-execution: one immediate and autonomous, and one delayed via the human-in-the-loop (HITL) scheduler queue.

I cleaned up the validation pipeline in `validateDynamicRestrictions` by:
1. Running `checkAutonomousPromotion` *first*.
2. Passing the *final* approval state down to `handleClassCAction`.
3. Updating `handleClassCAction` to only schedule the action if `requiresApproval` remained true.

This completely eliminated the over-engineered "fix it later" path and established monotonic flow in the safety validation pipeline. The system is cleaner and strictly adheres to both Principle 9 and Principle 3.