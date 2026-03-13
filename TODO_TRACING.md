# TODO: Branched Neural Path Tracing

Goal: Move from a linear trace log to a distributed, branched execution graph that supports true parallelism across multiple agents.

## 1. Infrastructure (DynamoDB)
- [x] Refactor `TraceTable` in `infra/storage.ts` to use a composite key (`traceId` as hashKey, `nodeId` as rangeKey).
- [x] Add `parentId` and `userId` fields to the trace schema.

## 2. Core Tracer (`core/lib/tracer.ts`)
- [x] Update `ClawTracer` to support initialization with specific `nodeId` and `parentId`.
- [x] Implement `getChildTracer()` method to spawn a new linked node for delegated tasks.
- [x] Refactor `startTrace` to use `PutCommand` with conditional existence check for the node.
- [x] Refactor `addStep` and `endTrace` to target specific `nodeId` via `UpdateCommand`.
- [x] Update `getTrace(traceId)` to perform a `Query` and return **all** nodes in the graph.

## 3. Tool Propagation
- [x] Update `Agent.ts` to automatically inject `traceId`, `nodeId`, and `parentId` into tool execution arguments.
- [x] Update `dispatchTask` tool to call `getChildTracer()` and pass the new IDs into the EventBridge payload.
- [x] Ensure `EventHandler` extracts and propagates these IDs when triggering sub-agents.

## 4. Multi-Modal Support
- [x] Update `ITool` interface to support `ToolResult` (text, images, metadata).
- [x] Update `Agent.process` loop to handle structured results.
- [x] Implement pass-through logic for built-in model tools (Code Interpreter, etc.).

## 5. Dashboard (ClawCenter)
- [x] Refactor `TraceDetailPage` to query all nodes for a trace.
- [x] Refactor `PathVisualizer.tsx` to render a Directed Acyclic Graph (DAG) instead of a vertical list.
- [x] Add visual indicators for parallel execution branches.
- [ ] Add support for rendering multi-modal outputs (images/plots) in the trace timeline.

## 6. Multi-Provider Alignment
- [x] Implement built-in tool pass-through for OpenAI.
- [x] Implement built-in tool pass-through for OpenRouter.
- [ ] Implement Host Capability adapters for Anthropic (Claude Computer Use).
- [ ] Implement Grounded Search adapter for Google Gemini.
