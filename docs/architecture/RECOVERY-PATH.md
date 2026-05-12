# Recovery Path Architecture

This document describes the idempotent recovery mechanisms used in Serverless Claw to ensure "Exactly-once" or "Idempotent At-least-once" semantics during system failures.

## Recovery Flow Diagram

```ascii
      Agent (Hand)       LockManager       Session (Brain)     AgentBus (Spine)        DLQ
           |                  |                  |                  |                  |
           |__________________|__________________|__________________|__________________|
           |                                NORMAL EXECUTION                            |
           |                  |                  |                  |                  |
           |--- acquire() --->|                  |                  |                  |
           |                  |                  |                  |                  |
           |--- addPending(Task A) ------------->|                  |                  |
           |                  |                  |                  |                  |
           |  [ CRASH! 💥 ]   |                  |                  |                  |
           |__________________|__________________|__________________|__________________|
           |                                 RECOVERY PATH                              |
           |                  |                  |                  |                  |
           |                  |<-- check exp. ---|                  |                  |
           |                  |                  |                  |                  |
           |                  |<-- acquire() ----|                  |                  |
           |                  |                  |                  |                  |
           |                  |                  |-- releaseProc() -|                  |
           |                  |                  |                  |                  |
           |                  |                  | [ IDEMPOTENCY ]  |                  |
           |                  |                  |--- emitEvent --->|                  |
           |                  |                  |    (Task A)      |                  |
           |                  |                  |                  |                  |
           |                  |                  |                  |-- reserveKey() --|
           |                  |                  |                  |                  |
           |                  |                  |                  | [ Key Not Exists ]
           |<------------------- New Trigger -----------------------|                  |
           |                  |                  |                  |                  |
           |                  |                  |                  |-- commitKey() ---|
           |                  |                  |                  |                  |
           |                  |                  |<-- removeMsg ----|                  |
           |                  |                  |                  |                  |
           |                  |                  |                  | [ Key Exists ]   |
           |                  |                  |<--- DUPLICATE ---|                  |
           |                  |                  |                  |                  |
           |                  |                  |-- removeMsg() ---|                  |
           |                  |                  |                  |                  |
```

## DLQ Retry Flow (Spine Resilience)

```ascii
  [ DLQ Entry ]
        |
        v
  < retryDlqEntry >
        |
        v
  [ emitEvent with IdempotencyKey ]
        |
        +-----------------------------+
        |                             |
  < reserveIdempotencyKey >       [ Failure ]
        |                             |
        +-------------+               v
        |             |      [ Wait for next retry ]
     ( New )     ( Duplicate )
        |             |
        v             |
  [ Commit & Emit ]   |
        |             |
        v             v
      [ Purge DLQ Entry ]
```

## Proactive Evolution Recovery (Safety Guard)

For Class C actions that require human approval, the `EvolutionScheduler` monitors for timeouts and triggers "Proactive Evolution" (Strategic Tie-Breaking). This path uses deterministic idempotency keys to ensure that a timed-out action is only triggered once across the system.

```ascii
 EvolutionScheduler        DynamoDB (MemoryTable)           AgentBus
         |                           |                         |
         |-- triggerTimedOut(wsId) ->|                         |
         |                           |                         |
         |<-- List of pending -------|                         |
         |                           |                         |
         | [ Loop: Each Action ]     |                         |
         |                           |                         |
         |-- claimAction(actionId) ->|                         |
         |   (Atomic Update)         |                         |
         |                           |                         |
         |      [ Status Pending ]   |                         |
         |<-- SUCCESS (triggered) ---|                         |
         |                           |                         |
         |--- emitTypedEvent(STRATEGIC_TIE_BREAK) ------------>|
         |    (key = eve-trigger:{id})                         |
         |                           |                         |
         |<-------------------------- EMMITED -----------------|
         |                           |                         |
         |      [ Status != Pending ]|                         |
         |<-- ConditionalCheckFailed-|                         |
         |                           |                         |
         |      ( SKIP )             |                         |
         |                           |                         |
```

````

## Atomic Multi-Tenant DLQ Retrieval

To prevent "In-Memory Multi-Tenant Filtering" (Anti-Pattern 19), the system utilizes server-side `FilterExpression` for DLQ retrieval. This ensures that even if a GSI is shared across tenants, data is filtered at the database layer before being returned to the application.

```ascii
[ Request DLQ ] --(workspaceId)--> [ DynamoDB ]
                                       |
                                       |-- Index: TypeTimestampIndex
                                       |-- FilterExpression: workspaceId = :ws
                                       |
                                   [ ISOLATED DATA ]
````

## Key Mechanisms

1.  **Deterministic Idempotency Keys**: Derived from unique message IDs (`resume:sessionId:msgId`) to ensure that even if metadata cleanup fails, the side effect (event emission) is only processed once.
2.  **Emit-then-Purge Strategy**: In the DLQ retry path, the event is emitted _before_ the DLQ entry is purged. Idempotency guards prevent duplicates, and the purge only happens upon confirmed success or confirmed duplication.
3.  **Fail-Closed Circuit Breakers**: Distributed state checks (`isCircuitOpen`, `consumeToken`) default to "Closed" (rejected) on system failures to prevent cascading instability.
4.  **Monotonic DLQ Filtering**: Ensures that background recovery tasks never cross-contaminate tenant recovery queues.
5. **Multi-Tenant Alert Scoping**: Critical failure alerts from background tasks must explicitly include `workspaceId`. Global tasks (like Dead Man's Switch) use `workspaceId: 'GLOBAL'`, while scoped recovery tasks (like DLQ routing) must extract and propagate the tenant ID from the original event to satisfy infrastructure-level EventBridge filters.
