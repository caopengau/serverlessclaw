# Concurrency & Session Isolation

In a serverless, stateless environment, maintaining session integrity is critical. Serverless Claw uses **Distributed Locking** to ensure that only one reasoning process acts on a session at a time.

## Distributed Locking (DynamoDB)

Unlike traditional servers that use in-memory locks, Claw uses a `LOCK#<chatId>` item in the `MemoryTable`.

```text
[User Msg A] -> [Lambda 1] -> [Acquire Lock] -> [ EXECUTE ] -> [ Release Lock ]
[User Msg B] -> [Lambda 2] -> [ Lock Check ] -> [ FAIL/EXIT ]
[User Msg C] -> [Lambda 3] -> [ Lock Check ] -> [ FAIL/EXIT ]
```

## Mechanism
1. **Acquisition**: At the start of a request, the handler attempts a conditional `PutItem` for the lock.
2. **TTL**: Locks have an automatic Time-To-Live (TTL) of 5 minutes to prevent session deadlocks in case of Lambda timeouts or crashes.
3. **Release**: Upon successful completion or caught error, the lock is explicitly deleted.

## Session Consistency
Because all state (History, Gaps, Skills) is stored in DynamoDB, different Lambda invocations can process sequential messages in the same session without losing context, provided they acquire the lock sequentially.
