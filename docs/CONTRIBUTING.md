# Contributing Guide

> **Agent Context Loading**: Load this file when you are (or are helping) a human contributor make code or documentation changes to Serverless Claw.

## Golden Rules

1. **Tests first**: Use TDD for any new tool or guardrail logic.
2. **Update the docs**: Every code change must update the relevant spoke in `docs/`. See `INDEX.md` for the mapping.
3. **No broken state**: `validate_code` must pass before any `trigger_deployment`.
4. **Protected files require human approval**: Do not attempt to bypass `PERMISSION_DENIED`.

---

## Development Workflow

```bash
# 1. Install deps
pnpm install

# 2. Run tests
npx vitest run

# 3. Local dev
pnpm exec sst dev

# 4. Type check
npx tsc --noEmit
```

---

## Pre-push Hooks

Husky runs `npx vitest run` and `npx tsc --noEmit` before every push. These must pass.

---

## Documentation Standard

All docs follow this front-matter convention (for agent progressive loading):

```markdown
> **Agent Context Loading**: Load this file when you need to [specific trigger].
```

Every spoke must:
- Open with the above callout describing **when to load it**.
- Use a table for structured reference data (the agent's first scan).
- Use diagrams for flows.
- End with an **"Adding a new X"** section so the Coder Agent knows how to extend.

---

## Commit Message Format

```
type: short description

- Detailed bullet (optional)
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`

---

## File Map

```
serverlessclaw/
├── INDEX.md          ← Hub (start here)
├── README.md         ← Public-facing overview
├── ARCHITECTURE.md   ← System topology
├── RESEARCH.md       ← Design decisions
├── ROADMAP.md        ← Future plans
├── docs/
│   ├── AGENTS.md     ← Agent roster & orchestration
│   ├── TOOLS.md      ← Tool registry & lifecycle
│   ├── SAFETY.md     ← All guardrails
│   └── CONTRIBUTING.md ← This file
├── src/              ← TypeScript source
└── sst.config.ts     ← Infrastructure definition
```
