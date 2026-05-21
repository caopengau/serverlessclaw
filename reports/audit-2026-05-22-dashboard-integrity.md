# Audit Report: Dashboard Integrity & Domain Separation

**Date**: 2026-05-22
**Auditor**: Framework Audit Agent
**Perspective**: Dashboard Integrity (G), Evolution Cycle (B)
**Silos Audited**: The Eye (5), Hand (2)

## What I Looked At
- The `makefiles/Makefile.devops.mk` logic for `check-framework-purity` and `audit-configuration`.
- The `apps/dashboard` structure to ensure the "Hub" is free of domain-specific "Spoke" pollution (like GoldEx or VoltX).

## What I Expected to Find
- The `makefiles/Makefile.devops.mk` should scan all framework directories (`packages/*`, `apps/dashboard`, `apps/cli`) to verify that no banned import strings (e.g., `voltx`, `goldex`) are hardcoded.
- The core framework dashboard (`apps/dashboard`) should be entirely generic, dynamically loading domain configs rather than tracking them.

## What I Actually Found
1. **Broken Purity Checks**: `Makefile.devops.mk` was scanning a non-existent `framework` folder instead of the actual `packages/` and `apps/` folders, rendering the OSS purity checks completely blind.
2. **Domain Pollution**: The `apps/dashboard/jobs.config.json` contained hardcoded references to `packages/goldex-core/ml` and `xauusd_training`, polluting the generic dashboard with GoldEx-specific Machine Learning logic.

## Findings

| Issue | Severity | Anti-Pattern | Description |
| :--- | :--- | :--- | :--- |
| **Broken Framework Purity Check** | P1 | AP-20 (Domain Pollution) | The DevOps purity checker was blind due to a misconfigured directory path (`framework`), allowing domain-specific pollution to leak into the OSS core undetected. |
| **Hardcoded Domain Logic in Dashboard** | P1 | AP-20 (Domain Pollution) | The `apps/dashboard` repository contained a `jobs.config.json` hardcoded with `goldex-core/ml` jobs. |

## Actions Taken
1. **Fixed `Makefile.devops.mk`**: Modified `PRODUCT_LEAKS` and `VIOLATIONS` `grep`/`find` commands to scan `packages/core packages/infra packages/primitives packages/hooks packages/sdk packages/ui apps/dashboard apps/cli`.
2. **Removed Domain Pollution**: Removed the hardcoded `apps/dashboard/jobs.config.json` from the repository, relying instead on the dynamic config loading resolution implemented in `src/app/api/jobs/route.ts`.
3. **Validated Integrity**: The `make -f makefiles/Makefile.devops.mk audit-configuration` now accurately reports `[SUCCESS] ✓ Framework is project-agnostic`.

## Recommended Follow-up
- Ensure domain-specific extensions (like `voltx`, `goldex`) provide their own UI "Spokes" correctly via the plugin interface without injecting tracked JSON files directly into the Dashboard workspace.
