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

### Self-Scheduling Utility
The `DynamicScheduler` (`core/lib/scheduler.ts`) provides a type-safe interface for managing EventBridge Scheduler schedules.
- **`ensureProactiveGoal`**: Atomically creates or updates a schedule for an agent task (e.g., Strategic Review).
- **Persistence**: Goal metadata is stored in the `ConfigTable` with a `GOAL#` prefix to maintain state across execution cycles.
- **Flexibility**: Supports both one-off tasks and recurring cron/rate expressions.

4. **Circuit Breakers**: To prevent runaway costs or unstable loops, the system enforces a deployment limit (Default: 5 per 24h).

## Proactive Lifecycle

```text
 [ Agent/Goal ]
        |
 (scheduleGoal)
        |
 [ AWS Scheduler ] --(time/rate)--> [ HeartbeatHandler ]
                                          |
                                 (HEARTBEAT_PROACTIVE)
                                          |
 [ AgentBus ] <---------------------------+
      |
 [ EventHandler ] --(Dispatch)--> [ Target Agent ]
                                     (Do Work)
```

## Triage & Recovery
The **SuperClaw** receives health signals with full error context. It can delegate to a **Coder Agent** for permanent code fixes or a **Recovery Agent** for immediate resource cycling or rollback.

## Observability & Service Level Objectives (SLOs)
Serverless Claw integrates a robust tracking system, emitting real-time signals to CloudWatch and maintaining persistent historical rollups in DynamoDB.

### Metric Topology

```text
 [ Agent Execution ] ----------(Tokens/Duration)--------> [ TokenTracker ] -> (Daily Rollups)
        |                                                       |
 [ LLM/Tool Calls  ] --(Success/Failure/Tokens)--> [ Metrics ]  |
        |                                              |        |
        +-------(CloudWatch Metrics / Dashboard)-------+        |
                                                       |        |
 [ SLO Tracker ] <------(Query Success Rates)-------------------+
        |
        +---->(Error Budget / Burn Rate Check)
        |
        v
 [ Alerting ] ---> (High Token Usage / Circuit Breaker / DLQ Overflow / High Error Rate)
        |
        +---> [ Notifier (Telegram) ]
```

1. **Token Tracking**: Per-invocation and rollup storage ensures granular usage visibility (including summarization). 
2. **CloudWatch Metrics**: Core paths (executors, handlers, buses, dead letter queues) continuously emit metric data.
3. **Alerting**: Automated notifications (via `OUTBOUND_MESSAGE`) push critical warnings like anomalous token usage, open circuit breakers, and DLQ overflow.
4. **SLO Tracking**: Monitors service availability, task success rate, and P95 latency against predefined budgets.
