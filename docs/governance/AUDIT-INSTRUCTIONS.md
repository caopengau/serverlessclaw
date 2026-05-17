# Audit Instructions for Future Agents

When instructed to audit the Serverless Claw system, follow this process:

## 1. Start Here

Read these documents first:

- `docs/governance/AUDIT.md` - Audit framework and methodology
- `docs/governance/AUDIT-COVERAGE.md` - What's been audited (avoid duplicates)
- `docs/governance/ANTI-PATTERNS.md` - Known recurring issues to watch for

## 2. Run Automated Checks

Before manual audit, always run:

```bash
# Run all quality checks
make check

# Run tests
make test

# Run principles verification (MUST PASS)
pnpm principles
```

The `pnpm principles` check verifies:

- Principle 13: Atomic State Integrity (conditional updates)
- Principle 14: Selection Integrity (enabled check in router)
- Principle 15: Monotonic Progress (atomic increment)
- Fail-Closed Rate Limiting

## 3. Required Audit Steps

Every audit MUST include:

### Step A: Pick a Silo or Perspective

Choose ONE from the Silo table in `AUDIT.md` or ONE Cross-Silo Perspective (A-G).

**Critical**: You MUST verify at least ONE cross-silo perspective per audit. See `AUDIT-COVERAGE.md` to find untested perspectives.

### Step B: Manual Verification

For your chosen area:

1. Read the relevant code files.
2. Check against `PRINCIPLES.md` design principles.
3. Look for anti-patterns in `ANTI-PATTERNS.md`.
4. Verify actual behavior vs expected behavior.

### Step C: Document Findings (Location Requirements)

> [!IMPORTANT]
> **Audit Report File Location & Tracking**:
> All audit reports MUST be generated in the **root `reports/` folder** of the workspace (`/reports/audit-<YYYY-MM-DD>-<topic>.md`).
> They **MUST NOT** be generated or tracked under the `docs/governance/` directory.
> To ensure these files are correctly tracked in Git despite the root `reports/` folder being gitignored by default, the `.gitignore` has been configured to exclude audit report markdown files via `!reports/audit-*.md`.

Create the report using the template specified in `docs/governance/AUDIT.md`.

Include:

- What you audited
- What you expected to find
- What you actually found
- Severity (P0/P1/P2/P3)
- Related anti-patterns (if any)

## 4. Identifying Priority Areas (Based on Coverage Matrix)

Audits should target areas that have either never been audited or have the lowest audit counts. To identify priority areas:

1. **Check Coverage Matrix**: Open [AUDIT-COVERAGE.md](./AUDIT-COVERAGE.md) and check the **Silo Coverage** and **Cross-Silo Perspectives Coverage** tables.
2. **Prioritize Gaps**: Any perspective with the lowest usage count or the oldest "Last Tested" date in the coverage matrix should be prioritized.
3. **High-Risk Silos**: The following components continuously warrant attention due to their safety-critical and high-concurrency nature:
   - **The Shield** (Silo 3) - Safety rule logic and rate limit boundaries.
   - **The Scales** (Silo 6) - Trust score calculations and parallel race conditions.
   - **The Spine** (Silo 1) - Monotonic recursion counters and EventBridge routing.

## 5. Quick Reference Commands

```bash
# Run automated verification
pnpm principles

# Run full test suite
make test

# Run linting
make check

# Run aiready scan (must score 80+)
pnpm aiready
```

## 6. Framework Integrity & Sync (Subtree Governance)

As a consumer of the ServerlessClaw framework, you must maintain the boundary between core framework code and application-specific logic.

1. **Core vs Spoke**: Framework-level changes (Registry logic, Bus, Memory, Safety) happen in `packages/core/`. Product-specific changes happen in their respective product packages.
2. **Promotion (sync-upstream)**: If you improve the framework core, promote these changes back using `make sync-upstream SYNC_UPSTREAM_REMOTE=<remote>`. This requires passing local quality gates first.
3. **Evolution (sync-downstream)**: Use `make sync-downstream` (or `make pull`) to pull improvements from the official upstream.
4. **Mandatory Squash**: **NEVER** perform a subtree pull without `--squash`. This is enforced by the `make` targets.
5. **Anti-Pattern 20: Domain Pollution**: Do NOT hardcode domain-specific logic (e.g., product-name, industry-specific terms) into the core framework packages. Ensure framework code remains product-agnostic for future OSS release.

## 7. Key Anti-Patterns to Watch (Summary)

See `ANTI-PATTERNS.md` for the full list of 19+ patterns, including:

1. Fail-open behavior (Security/Rate limits)
2. Non-atomic DynamoDB operations (Missing ConditionExpression)
3. Multi-tenant leakage (Missing workspaceId scoping)
4. Telemetry Blindness (Missing or unscoped metrics)
5. Race conditions in Lock/Session management
6. **New**: In-Memory Multi-Tenant Filtering (Anti-Pattern 19)

## Summary Checklist

1. Rotate focus away from recently edited files.
2. Verify Principle 11 (Isolation) is enforced.
3. Check both `core/` logic and `infra/` configuration.
4. Document findings and update `AUDIT-COVERAGE.md` (ensuring report paths are linked as `reports/audit-<date>-<topic>.md`).
