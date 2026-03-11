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
|  - Key: LESSON#<userId>                                             |
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

### 2. Tactical Lessons (`LESSON#`)
Short-term heuristics that help the agent self-correct. If the agent makes a mistake and the user corrects it, the agent distills a "Lesson" to avoid repeating it.
- **Update Frequency**: Medium.
- **Injection**: The most recent 10 lessons are loaded into the prompt to guide style and behavior.

### 3. Strategic Gaps (`GAP#`)
A backlog of features the system *knows* it doesn't have yet. This allows the system to be "Self-Aware" of its limitations.
- **Tracking**: Includes ROI, Complexity, and Risk.
- **Evolution**: The Planner Agent refers to these when designing the next "Upgrade".

### 4. Recent Traces (`TRACE#`)
The raw execution logs of the last few interactions.
- **Lookup**: Managed by the `TraceTable`.
- **Visualization**: Accessible via the ClawCenter dashboard.

## The Smart Recall Mechanism

Instead of shoving all history into every prompt, agents use the `recallKnowledge(query)` tool.

1. **Query**: The agent generates a search query (e.g., "How does the user prefer code documentation?").
2. **Search**: The system searches `LESSON#`, `GAP#`, and `DISTILLED#` keys in DynamoDB.
3. **Recovery**: Relevant snippets are returned to the agent's context.

> [!TIP]
> This "Jist-in-time" memory retrieval reduces input tokens by up to 90% in long-lived sessions while maintaining high context precision.
