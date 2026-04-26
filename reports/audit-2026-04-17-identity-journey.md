# Audit Report: Identity Journey (Brain → Spine → Shield) - 2026-04-17

## 🎯 Objective

Verify that identity (agentId, userId, workspaceId) propagates correctly from the Brain (Memory/Context) through the Spine (Routing) to the Shield (Safety Engine), specifically checking Perspective C ("Identity Journey"). Additionally, address test failures introduced by `pnpm principles` fixing Anti-Pattern #5.

## 🎯 Finding Type

- Bug / Gap / Inconsistency

## 🔍 Investigation Path

- Started at: `core/lib/safety/safety-engine.ts` and `core/lib/routing/AgentRouter.ts`
- Followed: The context propagation into `evaluateAction` and `handleClassCAction`.
- Observed: 
  1. `workspaceId` is notably absent from the `evaluateAction` context in `SafetyEngine`, breaking tenant isolation visibility at the safety layer.
  2. `pnpm principles` corrected Anti-Pattern #5 ("Double Execution of Class C Actions") by making `handleClassCAction` return `allowed: false` when `requiresApproval` is true. However, multiple tests (`agents/superclaw.test.ts`, `safety-engine.integration.test.ts`) were incorrectly asserting the anti-pattern (expecting `allowed: true` with `requiresApproval: true` and a `prod_deployment_approval` policy) instead of the newly corrected behavior.
  3. `make check` was failing due to a missing `getFullTopology` function in `AgentRegistry.ts` which was being used by the dashboard. `tsconfig.json` was also referencing `ignoreDeprecations` incorrectly.

## 🚨 Findings

| ID  | Title                                                 | Type          | Severity | Location                                            | Recommended Action                                                                                                             |
| :-- | :---------------------------------------------------- | :------------ | :------- | :-------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Missing workspaceId in Safety Context                 | Gap           | P2       | `core/lib/safety/safety-engine.ts:130`              | Update `evaluateAction` signature and `SafetyViolation` interface to include `workspaceId` to maintain tenant isolation. |
| 2   | Tests assert Anti-Pattern 5 (Double Execution)        | Bug           | P1       | `core/agents/superclaw.test.ts:121`                 | Fixed. Tests updated to correctly expect `allowed: false` and `appliedPolicy: 'class_c_approval_required'`.                    |
| 3   | Dashboard missing AgentRegistry.getFullTopology       | Bug           | P2       | `core/lib/registry/AgentRegistry.ts:132`            | Fixed. Replaced `getInfraConfig` with `getFullTopology` to correctly return a `Topology` object instead of an array.           |
| 4   | tsconfig `ignoreDeprecations` breaks `make check`       | Bug           | P3       | `tsconfig.json`                                     | Fixed. Removed invalid compiler options.                                                                                       |

## 💡 Architectural Reflections

The enforcement of `allowed: false` when `requiresApproval` is true natively in the Safety Engine is a significant improvement. However, the fact that tests were written expecting `allowed: true` AND `requiresApproval: true` simultaneously highlights that developers often misinterpret the combination of those two fields. Moving forward, `SafetyEvaluationResult` could consider a discriminated union state (e.g., `status: 'ALLOWED' | 'DENIED' | 'PENDING_APPROVAL'`) to prevent these contradictory states from being representable.

Also, as the system moves towards multi-tenant support via `workspaceId`, `workspaceId` MUST be plumbed universally alongside `userId` in all system contexts (Spine -> Shield) to enable proper Cross-Silo Identity Journeys.
