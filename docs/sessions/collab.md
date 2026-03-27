# Session Storage vs Traces
We discussed whether the new "multi-party collaboration" sessions should be the default way agents communicate.

**Conclusion: No, it should not be the default.**

We have a dual-mode system:
1. **Transactional (Traces & EventBridge):** The default for 80% of tasks. One agent sends a strict task payload to another agent, which completes it and returns a result. It is fast, isolated, and cheap. The `TRACE#` system tracks this execution graph.
2. **Session-Based (DynamoDB Collaboration):** Opt-in for 20% of complex tasks requiring negotiation, peer review, or human-in-the-loop discussion. All participants read from and write to a shared message history (`shared#collab#...`).

**Why not default?**
Putting all agent chatter into a shared session causes "context dilution," slowing down agents, wasting tokens, and increasing hallucination risks.

---
# Managing Boundaries & Coordination in Session Mode

In a shared session, without explicit boundaries, agents might talk endlessly or talk over each other. 

Coordination requires specific roles and mechanisms:

### 1. The Owner/Moderator Role
Every collaboration has an `owner` (defined in the `Collaboration` type). The owner acts as the moderator. For example, if the Strategic Planner initiates a Council Review session:
* The **Planner (Owner)** opens the session and drops the initial proposal.
* The **Critics (Participants)** review and drop their thoughts.
* The **Planner (Owner)** is responsible for analyzing the feedback, driving a conclusion, and calling `closeCollaboration`.

### 2. Turn-Taking vs Concurrent Writes
Unlike human chats where everyone types at once, AI swarms need structured turn-taking to prevent infinite loops.
* **Implicit Turn-Taking:** A message from Agent A triggers a webhook or event that wakes up Agent B.
* **Explicit Tasking:** Even within a session, the Owner can direct specific agents by mentioning them, preventing everyone from responding to every message.

### 3. Conclusion & Extraction
A session must result in a structured output (a plan, a fix, a decision). The Owner is responsible for:
1. Synthesizing the final decision.
2. Executing a tool (like `triggerDeployment` or `dispatchTask` to a Coder).
3. Closing the collaboration session using the `closeCollaboration` tool so agents stop monitoring it.

This mirrors how the existing `ParallelAggregator` works for transactional fan-outs, but applies it to an iterative chat context.