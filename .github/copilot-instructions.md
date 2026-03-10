# Serverless Claw Copilot Instructions

Start here for all coding tasks in this repository.

## Required Context Load Order

1. Read [`INDEX.md`](../INDEX.md) first.
2. If the task involves checks, testing, deployment, release, make targets, or CI/CD, read [`docs/DEVOPS.md`](../docs/DEVOPS.md) before making changes.
3. If the task involves infra topology or SST resources, read [`ARCHITECTURE.md`](../ARCHITECTURE.md).

## Deployment Safety Rule

- Local development must use stage `local`.
- Shared deployment must use stage `dev`.
- Do not run `sst dev --stage dev`.

## Documentation Sync Rule

When changing deployment or release behavior, update:

- [`docs/DEVOPS.md`](../docs/DEVOPS.md)
- [`INDEX.md`](../INDEX.md) if navigation/load order changed
