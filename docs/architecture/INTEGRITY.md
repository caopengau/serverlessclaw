# System Integrity Architecture

This document describes the integrity and atomicity mechanisms implemented to ensure monotonic progress and multi-tenant isolation in Serverless Claw.

## 1. Atomic State Transitions (Silo 5)

We use DynamoDB `ConditionExpression` to prevent "Last Write Wins" race conditions during trace initialization and metric recording.

```ascii
   Agent                Tracer                DynamoDB
     |                    |                      |
     |-- initialize(id) ->|                      |
     |                    |-- PutItem (Summary) -|
     |                    |   w/ Condition       |
     |                    |                      |
     |                    |<-- Success (OK) -----|
     |<-- Initialized ----|                      |
     |                    |                      |
     |                    |OR (Conflict Case)    |
     |                    |                      |
     |                    |<-- ConditionCheckFailed
     |<-- Error (Conflict)|                      |
```

## 1b. Atomic Message Persistence (Silo 4)

To prevent overwrites when multiple messages for the same user/session arrive at the same millisecond, the system uses a unique micro-timestamp with entropy and conditional writes.

```ascii
   Agent 1             Agent 2                DynamoDB
      |                   |                      |
      |-- addMsg(T=now) --|                      |
      |                   |-- addMsg(T=now) -----|
      |                   |                      |
      |-- Put (SK=now#r1) ---------------------->|
      |   w/ attribute_not_exists                |
      |                   |                      |
      |                   |<-- SUCCESS (200) ----|
      |                   |                      |
      |                   |-- Put (SK=now#r2) -->|
      |                   |   w/ attribute_not_exists
      |                   |                      |
      |<-- SUCCESS (200) -|                      |
      |                   |<-- SUCCESS (200) ----|
```

## 1c. Collaboration Index Jitter (Perspective C)

To prevent overwrites when multiple collaborations share a participant at the same millisecond, the system uses a jittered retry loop.

```ascii
  Identity Service        DynamoDB (Collab Index)
         |                        |
         |-- Put (T=now) -------->|
         |    w/ attribute_not_exists(userId)
         |                        |
         |<-- Conflict (409) -----|
         |                        |
         |-- Put (T=now+1) ------>|
         |                        |
         |<-- Success (200) ------|
         |                        |
```

## 1d. Hard Shell Identity Normalization (Perspective C)

To prevent identity spoofing and internal protocol leakage, the system enforces a strict sanitization boundary at the input layer.

```ascii
  External Input        normalizeMessage()        Internal Event Bus
 (Telegram/Slack)        (The Hard Shell)           (SuperClaw)
        |                       |                       |
        |-- {userId: "CONV#S"}->|                       |
        |                       |-- sanitize(# -> _) ---|
        |                       |                       |-- {userId: "CONV_S"}
        |                       |                       |   (Safe/Unprivileged)
        |                       |                       |
        |-- {userId: "SYSTEM"}->|                       |
        |                       |-- allow (no #) -------|
        |                       |                       |-- {userId: "SYSTEM"}
        |                       |                       |   (Auth verified)
```

## 2. Multi-Tenant Budget Enforcement (Shield)

Token usage and recursion depth are tracked with strict `workspaceId` dimensioning to prevent cross-tenant budget leakage.

````ascii
+-------------------------------------------------------------+
| TokenBudgetEnforcer (Shield Layer)                          |
+-------------------------------------------------------------+
|                                                             |
|  [ Event ] --> [ recordUsage(workspaceId) ]                 |
|                       |                                     |
|                       v                                     |
|           +-----------------------+                         |
|           | DynamoDB (Tenanted)   |                         |
|           | PK: WS#<id>#BUDGET#<id> | (Atomic Versioning)   |
|           +-----------------------+                         |
|                       |                                     |
|                       v                                     |
|           [ checkBudget() ] --> ( ALLOW / DENY )            |
|                                                             |
+-------------------------------------------------------------+

### 2c. Isolated S3 Staging Pipeline (Shield)

To prevent data leakage and race conditions during parallel coder tasks, the system partitions S3 staging objects using `traceId`.

```ascii
[ Coder Agent 1 ] --(patch)--> [ stageChanges ] --(Upload: staged_T1.zip)--> [ S3 Staging ]
                                                                                  |
[ Coder Agent 2 ] --(patch)--> [ stageChanges ] --(Upload: staged_T2.zip)--> [ S3 Staging ]
                                                                                  |
                                                                                  v
[ Merger Handler ] <---(Fetch: staged_T1.zip, staged_T2.zip)---------------- [ S3 Staging ]
       |
       |-- (Merge & Apply Patches)
       |
       +--(Upload Merged)--> [ S3 Staging: staged_trace-abc.zip ]
                                       |
                                       v
[ Deployment Tool ] <---(staged_trace-abc.zip)--- [ CodeBuild ]
```

### 2b. Class C Blast Radius Isolation (Shield)

To prevent cross-tenant limit sharing, the `BlastRadiusStore` uses workspace-prefixed partition keys for sensitive action frequency tracking.

```ascii
[ Class C Action ] --(agentId, action, workspaceId)--> [ BlastRadiusStore ]
                                                            |
                                                            v
                                                   +-------------------------+
                                                   | DynamoDB (MemoryTable)  |
                                                   | PK: WS#<id>#SAFETY#BLAST#<agentId>:<action> |
                                                   +-------------------------+
                                                            |
                                                            v
                                                   [ Count < 5/hour? ] --> ( ALLOW / BLOCK )
````

````

## 3. Regenerative Metabolism (Silo 7)

Autonomous repairs ensure the system prunes its own technical debt and stale infrastructure.

| Repair Target | Mechanism                   | Trigger                        |
| ------------- | --------------------------- | ------------------------------ |
| S3 Staging    | `pruneStagingBucket`        | `STAGING_RETENTION_DAYS` (30d) |
| Agent Tools   | `pruneLowUtilizationTools`  | Atomic Utilization Audit       |
| Memory Gaps   | `cullResolvedGaps`          | Resolution Event               |
| Dashboard     | `remediateDashboardFailure` | Real-time Exception Handler    |
| DLQ Recovery  | `getDlqEntries`             | System Maintenance / Retry     |

### 3b. Atomic Multi-Tenant Isolation (AP-19 Remediation)

To ensure strict isolation during background maintenance, all query-based retrieval (such as DLQ scanning) MUST use server-side `FilterExpression`. In-memory multi-tenant filtering is prohibited as it creates a potential for data leakage if the filter is bypassed.

```ascii
[ Metabolism ] -> [ getDlqEntries(workspaceId) ]
                        |
                        v
                [ Query (TypeTimestampIndex) ]
                [ FilterExpression: workspaceId = :ws ]
````

## 4. Recovery Path (Shield -> Spine -> Brain)

Detailed documentation of the idempotent resumption and DLQ retry logic can be found in [RECOVERY-PATH.md](./RECOVERY-PATH.md).

The system uses a tiered fallback mechanism ("Dead Man's Switch") to handle failures at different layers:

```ascii
[ Failure Detected ]
       |
       v
[ health-handler ] --(Success)--> [ REPAIRED ]
       |
       +--(Complex)--> [ EvolutionScheduler ] --> [ HITL Remediation ]
       |
       +--(Critical)--> [ Dead Man's Switch ] --> [ Emergency Rollback ]
```

## 5. Modular Configuration Hierarchy (Silo 5)

To maintain AI context integrity and modularity, `ConfigManager` is implemented via a multi-level inheritance chain.

```ascii
+-----------------------------+
|      ConfigManager Base     | (CRUD, Caching, Scoping)
+--------------+--------------+
               |
               v
+--------------+--------------+
|      ConfigManager List     | (Atomic List Appends/Removals)
+--------------+--------------+
               |
               v
+--------------+--------------+
|   ConfigManager Map Atomic  | (Atomic Numeric Increments)
+--------------+--------------+
               |
               v
+--------------+--------------+
| ConfigManager Map Colls     | (Collections within Map Entities)
+--------------+--------------+
               |
               v
+--------------+--------------+
|      ConfigManager Map      | (Basic Entity Operations)
+--------------+--------------+
               |
               v
+-----------------------------+
|      ConfigManager         | (Agent Overrides & Entry Point)
+-----------------------------+
```

## 6. Isolated Trust Calibration Loop (Silo 6)

To maintain trust integrity without cross-tenant interference, the Trust Calibration Loop (Perspective D) enforces strict `workspaceId` scoping from metric collection to anomaly detection and final trust score updates.

```ascii
[ The Eye ]          [ The Scales ]             [ DynamoDB ]
     |                    |                          |
     |-- getMetrics(WS1) ->|                          |
     |                    |                          |
     |                    |-- getThresholds(WS1) --->|
     |                    |                          |
     |                    |<- (WS1 Safety Tier) -----|
     |                    |                          |
     |-- (Metrics) ------>|                          |
     |                    |-- detectAnomalies(WS1) ->|
     |                    |                          |
     |                    |-- recordTrust(WS1) ----->|
     |                    |   (Atomic Condition)     |
     |                    |                          |
     |                    |-- clamp(0-100) --------->|
     |                    |   (Conditional Update)   |
```

### 6b. Version-Conditional Telemetry (The Eye)

To prevent "Last Write Wins" races during latency rollup calculations, the system uses the `invocationCount` as a monotonic version marker.

```ascii
Process 1 (Eye)          Process 2 (Eye)          DynamoDB (Rollup)
      |                        |                         |
      |-- (1) Read (v=5) ------------------------------> |
      |                        |-- (2) Read (v=5) ------>|
      |                        |                         |
      |-- (3) Write (v=6) -----------------------------> | (Success)
      |   Condition: v=5       |                         |
      |                        |-- (4) Write (v=6) ----> | (REJECTED)
      |                        |   Condition: v=5        | (Conflict 409)
```

This ensures that high-precision metrics (p95/p99) are never corrupted by concurrent telemetry streams, preventing false SLO breaches.

## 7. Workspace-Scoped MCP Multiplexing (Silo 2)

To prevent cross-tenant data leakage in the Unified MCP Multiplexer, the system enforces dynamic path scoping for all filesystem-based tools.

```ascii
[ MCP Request ] --(headers: x-workspace-id=WS1)--> [ Multiplexer ]
                                                        |
                                                        v
                                             [ resolveWorkspace(WS1) ]
                                                        |
                                                        v
                                             [ execSync: mkdir -p /tmp/ws-WS1 ]
                                                        |
                                                        v
                                             [ Spawn MCP Server ]
                                             [ args: --root /tmp/ws-WS1 ]
                                             [ env: HOME=/tmp/ws-WS1 ]
```

This ensures that tools like `filesystem_write_file` or `git-mcp-server` are physically restricted to a tenant-specific jail within the shared Lambda `/tmp` space.

## 8. Domain-Driven UI Isolation (Silo 8)

To prevent domain-specific UI defects from compromising the framework's operational stability, the dashboard uses a sandboxed "Spoke Injection" pattern.

```ascii
[ Dashboard Hub ] --(render)--> [ Hub Navigation ]
                                        |
                           [ Extension Loader (Silo 8) ]
                                        |
                           [ Try-Catch Dynamic Import ]
                                        |
                           [ Plugin Registry (Spoke) ]
```

1.  **Failure Tolerance**: The `ExtensionLoader` uses a non-blocking `try-catch` during the dynamic import of `extensions/index.ts`. If a plugin is missing or contains syntax errors, the framework continues to function with default capabilities.
2.  **RBAC Propagation**: Permissions (e.g., `requiredRoles`) are verified before a plugin item is rendered in the sidebar, ensuring that domain-specific tools are only visible to authorized users even if they are dynamically injected.
3.  **Mount-Once Enforcement**: The system uses a `loaded` ref to ensure that domain extensions are initialized exactly once per session, preventing duplicate event listeners or memory leaks during navigation.

```

```
