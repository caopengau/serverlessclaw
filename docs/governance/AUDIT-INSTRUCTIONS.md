
3. Multi-tenant leakage (Missing workspaceId scoping)
4. Telemetry Blindness (Missing or unscoped metrics)
5. Race conditions in Lock/Session management
6. **New**: In-Memory Multi-Tenant Filtering (Anti-Pattern 19)

## 8. Framework Integrity & Sync (Subtree Governance)

As a consumer of the ServerlessClaw framework, you must maintain the boundary between core framework code and application-specific logic.

1. **Core vs Spoke**: Framework-level changes (Registry logic, Bus, Memory, Safety) happen in `framework/`. Application-level changes happen in the product-specific packages (e.g., `packages/app-*`).
2. **Promotion (sync-upstream)**: If you improve the framework core, promote these changes back using `make sync-upstream SYNC_UPSTREAM_REMOTE=<remote>`. This requires passing local quality gates first.
3. **Evolution (sync-downstream)**: Use `make sync-downstream` (or `make pull`) to pull improvements from the official upstream.
4. **Mandatory Squash**: **NEVER** perform a subtree pull without `--squash`. This is enforced by the `make` targets.
5. **Anti-Pattern 20: Domain Pollution**: Do NOT hardcode domain-specific logic (e.g., product-name, industry-specific terms) into the `framework/` directory. Ensure framework code remains product-agnostic for future OSS release.

## Summary Checklist

1. Rotate focus away from recently edited files.
2. Verify Principle 11 (Isolation) is enforced.
3. Check both `core/` logic and `infra/` configuration.
4. Document findings and update `AUDIT-COVERAGE.md`.
