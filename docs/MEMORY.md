# Memory Management: The Tiered Neural Engine

Serverless Claw uses a tiered, evolutionary memory system designed to provide context-rich interactions while minimizing "prompt bloat" and token costs.

## Architecture Diagram

```text
+-----------------------------------------------------------------------+
|                        AGENT REASONING LOOP                           |
+-----------------------------------------------------------------------+
           |                                             ^
           v                                             |
+-----------------------+                      +-----------------------+
|  Context Weaver      |                      |  Knowledge Retriever  |
|  (Prompt Assembly)   |                      |  (Smart Recall Tool)  |
+-----------+-----------+                      +-----------+-----------+
            |                                             ^
            |                                             |
            v                                             |
+-----------+---------------------------------------------+-----------+
|                          MEMORY ADAPTER                             |
|                          (DynamoDB / S3)                            |
+---------------------------------------------------------------------+
|                                                                     |
|  [ TIER 1: LONG-TERM FACTS ]                                        |
|  - Key: DISTILLED#<userId>                                          |
|  - Purpose: Core identity, permanent preferences, "Who am I?"       |
|                                                                     |
|  [ TIER 2: TACTICAL LESSONS ]                                        |
|  - Key: LESSON#<userId> / TACTICAL#<userId>                         |
|  - Purpose: Multi-turn heuristics (e.g., "Use bullet points")       |
|                                                                     |
|  [ TIER 3: STRATEGIC GAPS ]                                          |
|  - Key: GAP#<gapId>                                                 |
|  - Purpose: Backlog of missing tools or sub-agent capabilities.     |
|                                                                     |
|  [ TIER 4: RECENT TRACES ]                                           |
|  - Key: TRACE#<traceId>                                             |
|  - Purpose: Immediate short-term context of the current session.    |
|                                                                     |
+---------------------------------------------------------------------+
```

## Memory Tiers Explained

### 1. Long-Term Facts (`DISTILLED#`)
Permanent knowledge about the user. This is the "Base Identity" of the session. It includes name, role, and overarching goals.
- **Update Frequency**: Low (only when significant identity shifts occur).
- **Injection**: Loaded into the System Prompt for EVERY request.

### 2. Tactical Lessons (`LESSON#` / `TACTICAL#`)
Short-term heuristics distilled by the **Cognition Reflector**. If the agent makes a mistake or a technical "gotcha" is discovered, it's saved here to prevent repetition.
- **Update Frequency**: Medium.
- **Injection**: The most relevant lessons are selectively loaded into the prompt.

### 3. Strategic Gaps (`GAP#`)
A backlog of missing capabilities identified by the Reflector. These gaps are the primary driver for the system's **Self-Evolution**.
- **Tracking**: Includes ROI, Complexity, and Risk signals.
- **Evolution**: The **Strategic Planner** reviews these during its deterministic **48-hour review** cycle to design the next system upgrade.

### 4. Recent Traces (`TRACE#`)
The raw, mechanical execution logs of every interaction. 
- **Lookup**: Managed by the `TraceTable`.
- **Visualization**: Accessible via the **Intelligence** sector of the dashboard.

## Human-Agent Co-Management (Neural Reserve)

Memory is not a "black box" in Serverless Claw. Through the **Neural Reserve** page (Evolution sector) in ClawCenter, users can:
- **Audit**: View all distilled facts, lessons, and identified gaps.
- **Prioritize**: Manually adjust the priority of a `GAP#` to influence the Planner's roadmap.
- **Prune**: "Weed" the memory garden by deleting stale or incorrect items.
- **Focus**: Toggle "HOT_PATH" status for tactical lessons to ensure they are always present in the reasoning loop.

## The Smart Recall Mechanism

Instead of shoving all history into every prompt, agents use the `recallKnowledge(query)` tool.

1. **Query**: The agent generates a search query (e.g., "How does the user prefer code documentation?").
2. **Search**: The system searches `LESSON#`, `GAP#`, and `DISTILLED#` keys in DynamoDB.
3. **Recovery**: Relevant snippets are returned to the agent's context "Just-In-Time".

> [!TIP]
> This retrieval strategy reduces input token costs by up to 90% in long-lived sessions while maintaining high context precision and system self-awareness.
