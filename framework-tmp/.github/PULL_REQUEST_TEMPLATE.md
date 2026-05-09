## Summary

Provide a brief description of the changes and the problem being solved.

### Related Issues

Closes # (issue number)

---

## 🚀 Mandatory Quality Gate Checklist

> **CRITICAL**: ALL applicable items MUST be completed before review. No exceptions.

### 1. Testing (REQUIRED)

- [ ] **New module**: Created co-located `*.test.ts` with unit tests (happy path + error cases).
- [ ] **Modified module**: Updated existing `*.test.ts` to cover new behavior.
- [ ] **Contract tests**: Updated `core/tests/contract.test.ts` if new event types or schemas were added.
- [ ] **Tools**: Verified tool is listed in `core/lib/constants.ts` (if applicable).
- [ ] **Run local**: `make test` passes.

### 2. Documentation (REQUIRED)

- [ ] **Spoke Updates**: Updated the relevant spoke document in `docs/` (`AGENTS.md`, `TOOLS.md`, `ARCHITECTURE.md`, etc.).
- [ ] **ASCII Diagrams**: Added/Updated sequence or architecture diagrams for system-level changes.
- [ ] **Index Update**: Verified `INDEX.md` and `docs/CONTRIBUTING.md` remain accurate.

### 3. Quality (REQUIRED)

- [ ] **Lint & Format**: `make check` passes (lint + format + typecheck).
- [ ] **No suppressions**: No new `eslint-disable` or `@ts-ignore` without justification.
- [ ] **AI Readiness**: Ran `make aiready` and verified score/impact.

### 4. Constants & Types (REQUIRED for infra/core changes)

- [ ] New tool name added to `TOOLS` enum.
- [ ] New memory key prefix added to `MEMORY_KEYS`.
- [ ] New event type added to `EventType` enum.

---

## 🎨 Design (if applicable)

- Screenshots/recordings highlighting UI changes.
- Brief overview of design decisions.

---

## 🧪 Verification Plan

- [ ] Steps for manual verification.
- [ ] Results of regression testing.
