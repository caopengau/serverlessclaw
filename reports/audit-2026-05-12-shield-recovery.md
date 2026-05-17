# Audit Report: The Shield & Recovery Path

**Date:** 2026-05-12
**Silo Focus:** Silo 3 (The Shield)
**Perspective Focus:** Perspective E (Recovery Path)
**Methodology:** Negative Space & Top-Down (Architecture -> Implementation)

## Findings

### 1. [P1] Cross-Tenant Data Leakage in Semantic Loop Detector (Anti-Pattern 19)
* **Location:** `packages/core/lib/safety/semantic-loop-detector.ts`
* **Issue:** The `SemanticLoopDetector` was caching the LRU output history based solely on `sessionId`. If two separate tenants (workspaces) utilized the same generated `sessionId` (e.g., standard API clients generating common IDs or default CLI sessions), their reasoning loops would bleed into each other, triggering false positives and cross-tenant memory poisoning.
* **Resolution:** Modified `check` and `clearSession` methods to accept `workspaceId` and scoped the internal `sessions` LRU cache keys to `WS#${workspaceId}#${sessionId}`. Added integration tests to explicitly verify this isolation.

### 2. [P1] Alerting and Telemetry Blindness in Dead Man's Switch (Anti-Pattern 4 / Anti-Pattern 3)
* **Location:** `packages/core/handlers/recovery.ts`
* **Issue:** Auditing the "Negative Space" (what is missing), I found that the `DeadMansSwitch` handler emitted `OUTBOUND_MESSAGE` alerts and `METRICS.deploymentStarted()` without a `workspaceId`. The infrastructure definition (`infra/shared.ts`) enforces `requireWorkspace: true` on the `getTenantEventFilter`, meaning EventBridge silently dropped these critical failure alerts, leading to complete alerting blindness during a catastrophic system failure.
* **Resolution:** Explicitly added `workspaceId: 'GLOBAL'` to the `alert` payload and the metrics emission, satisfying the infrastructure filter and ensuring alerts reach the `Notifier` agent.

### 3. [Verified] Infrastructure Least Privilege for Recovery Handler
* **Location:** `packages/infra/agents/maintenance-handlers.ts`
* **Observation:** Reviewed the `DeadMansSwitch` agent permissions.
* **Finding:** IAM permissions are strictly scoped. It relies exclusively on the standard DynamoDB access via `baseLink` for locking/LKG tracking and only adds `codebuild:StartBuild` strictly constrained to the specific `deployer.arn`. No excessive `logs:*` or `iam:*` permissions are granted.

## Verification
- Applied code modifications and verified using the project's automated tools.
- `make check`, `make test`, and `pnpm principles` all executed successfully.
