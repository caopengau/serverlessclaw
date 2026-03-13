# Autonomous Health & Monitoring

Beyond build failures, Serverless Claw monitors its own operational integrity through **Signal-based Triage** and self-reporting.

## Health Architecture

```text
 [ Any Component ]
        |
 (Health Violation)
        |
        +----------------------------+
        |  SYSTEM_HEALTH_REPORT      |
        |  (AgentBus)                |
        +-------------+--------------+
                      |
        ______________V______________
       |                             |
       |     EVENT_HANDLER           | (SuperClaw)
       |     (Triage Brain)          |
       |_____________________________|
              |
      (Reason & Dispatch)
              |
      +-------+-------+
      |               |
 [ Coder Agent ]  [ Recovery Agent ]
 (Fix Code)       (Cycle Resource)
```

## Monitoring Mechanisms

1. **Dead Man's Switch**: An hourly schedule that performs high-level health checks (e.g., API responsiveness, database connectivity).
2. **Self-Reporting**: Components are instrumented with `reportHealthIssue` to signal the AgentBus when internal invariants are violated.
3. **Circuit Breakers**: To prevent runaway costs or unstable loops, the system enforces a deployment limit (Default: 5 per 24h).

## Triage & Recovery
The **SuperClaw** receives health signals with full error context. It can delegate to a **Coder Agent** for permanent code fixes or a **Recovery Agent** for immediate resource cycling or rollback.
