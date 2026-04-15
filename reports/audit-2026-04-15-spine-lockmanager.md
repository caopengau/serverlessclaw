# Audit Report: The Spine (LockManager Race Condition) - 2026-04-15

## 🎯 Objective

Investigated "The Spine" silo, specifically looking into distributed locking mechanisms and potential race conditions as prompted by the System Audit & Exploration guide. The objective was to audit the lifecycle of a distributed lock under high concurrency.

## 🎯 Finding Type

- Bug (Functional Failure)

## 🔍 Investigation Path

- Started at: `core/lib/lock/lock-manager.ts`
- Followed: The `release` method implementation and its interaction with DynamoDB.
- Observed: A significant race condition in the `release` method.

## 🚨 Findings

| ID  | Title | Type | Severity | Location | Recommended Action |
| :-- | :--- | :--- | :------- | :------- | :----------------- |
| 1 | Race condition in LockManager.release | Bug | P1 | `core/lib/lock/lock-manager.ts:121` | Refactor `release` to use a single, atomic DynamoDB `UpdateCommand` with a strict `ConditionExpression: ownerId = :owner OR expiresAt < :now` instead of reading the state first and then unconditionally updating. |

### Details
The `LockManager.release` method previously checked the lock state via a `getLockState` call (GetCommand). If the lock was either owned by the caller OR expired, it then proceeded to issue an `UpdateCommand` to remove the lock attributes. However, the condition for this `UpdateCommand` was weakly defined as `attribute_exists(ownerId) OR attribute_not_exists(ownerId)`.

This created a severe race condition:
1. Process A invokes `release` and `getLockState` shows the lock is expired.
2. Before Process A's `UpdateCommand` executes, Process B successfully acquires the lock (as it correctly determines the lock is expired).
3. Process A's unconditional `UpdateCommand` executes, deleting the newly acquired lock held by Process B.
4. Now Process C can acquire the lock, leading to both Process B and Process C believing they hold the same lock.

**Fix Applied:**
The `release` logic was refactored into a single, atomic `UpdateCommand`. The condition was updated to `ownerId = :owner OR expiresAt < :now`, enforcing that a lock is only released if the requester still owns it or if it is verifiably expired at the moment of the update. The accompanying tests in `lock-manager.test.ts` and `lock-manager.concurrency.test.ts` were also rewritten to reflect the unified update.

## 💡 Architectural Reflections

The system's principle of **Atomic State Integrity** mandates that field-level atomic updates are used in high concurrency scenarios. This bug was a direct violation of this principle, as it relied on a non-atomic "read-modify-write" sequence across distributed nodes. The fix explicitly aligns the LockManager with Principle 13.
