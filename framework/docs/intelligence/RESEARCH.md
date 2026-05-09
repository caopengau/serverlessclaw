# Research & Discovery Mode

> **Navigation**: [← Index Hub](../../INDEX.md)

The system features a specialized **Research Agent** (Researcher) designed for deep technical exploration, library analysis, and pattern discovery. It can be triggered by the **Strategic Planner** or **SuperClaw** using the `requestResearch` tool.

## 🔍 Research Workflow

Research operates in two primary modes based on the complexity of the goal:

### 1. Single Search (Linear)

For straightforward questions, the Researcher performs a standard iterative reasoning loop, using MCP tools (Search, Fetch, Puppeteer) sequentially to reach a conclusion.

### 2. Parallel Exploration (Swarm)

For complex comparisons or broad discovery, the Researcher **self-decomposes** the goal into parallel sub-tasks. These are dispatched to multiple Researcher instances, aggregated via DynamoDB, and synthesized into a final report.

## 📊 Research Flow Diagram

```text
    [ INITIATOR ] (Strategic Planner / SuperClaw)
          |
          v
   ( RESEARCH_TASK ) ----> [ RESEARCH HANDLER ]
          |                       |
          |           /-----------+-----------\
          |           |                       |
          |    [ MODE: SINGLE ]       [ MODE: PARALLEL ]
          |           |               (Goal Decomposition)
          |           |                       |
          |    ( Sequential )        ( Parallel Dispatch )
          |    ( Tool Calls )        /        |        \
          |           |       [Sub-T1]    [Sub-T2]    [Sub-T3]
          |           |          |           |           |
          |           |          \-----------+-----------/
          |           |                      |
          |           |             [ DYNAMO AGGREGATOR ]
          |           |                      |
          |           |             [ RESEARCH SYNTHESIS ]
          |           |                      |
          \-----------+----------------------/
                      |
                      v
             [ WAKEUP INITIATOR ]
             ( TASK_COMPLETED )
                      |
                      v
    [ INITIATOR ] (Resumes with Research Findings)
```

## 💾 Research Persistence

Unlike transient agent traces, the findings from a Research Mode session are often persisted in the **Intelligence Tier** of the memory engine to ensure that the system "learns" from discovered patterns without needing to re-research the same topic.

- **Storage**: Distilled lessons are stored with the `LESSON#` prefix.
- **Recall**: Future agents can recall these findings using the `recallKnowledge` tool.
