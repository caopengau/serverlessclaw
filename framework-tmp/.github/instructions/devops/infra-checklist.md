# Infrastructure Checklist

## SST Resource Naming

- Use descriptive names for SST resources.
- Ensure all resources have tags if required by the [Security Policy](../../docs/intelligence/SAFETY.md).

## Change Validation

- Before modifying `infra/`, run `make check` to ensure no breaking type changes.
- Always verify resource impacts in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Workspace Hygiene

- Ensure all workspace dependencies are installed via `pnpm install`.
- Verify `.gitignore` covers new build artifacts (e.g., `.next`, `.open-next`, `.sst`, `sst-env.d.ts`).
- Ensure generated files like `next-env.d.ts` are untracked to avoid cross-environment conflicts.
