# Agent Entry Point

For any agent working in this repo, load context in this order:

1. [`INDEX.md`](./INDEX.md)
2. [`docs/DEVOPS.md`](./docs/DEVOPS.md) for checks, deploy, release, or make targets
3. [`ARCHITECTURE.md`](./ARCHITECTURE.md) for SST/infra changes
4. [`docs/AGENTS.md`](./docs/AGENTS.md) for orchestration and agent behavior

## Stage Hygiene

- `make dev` -> stage `local` (for local development)
- `make deploy` -> stage `dev` (single deployment environment)
- Never use `sst dev` against the deployment stage.
