# TODO: Branched Neural Path Tracing

Goal: Move from a linear trace log to a distributed, branched execution graph that supports true parallelism across multiple agents.

## 1. Infrastructure (DynamoDB)
- [ ] Refactor `TraceTable` in `infra/storage.ts`.
    - [ ] Change from Single Primary Key (`traceId`) to **Composite Key**.
    - [ ] **Partition Key**: `traceId` (The unique ID for the entire conversation/workflow).
    - [ ] **Sort Key**: `nodeId` (Unique ID for each specific agent execution or branch).
- [ ] Add `parentId` field to trace items to allow graph reconstruction.

## 2. Core Logic (ClawTracer)
- [ ] Update `ClawTracer` constructor to accept `nodeId` and `parentId`.
- [ ] Modify `startTrace` to handle node-level initialization.
- [ ] Ensure `addStep` uses `UpdateCommand` targeting the specific `nodeId`.
- [ ] Implement `getChildTracer()` method to spawn new branches with correct parent linking.

## 3. Propagation
- [ ] Update `dispatchTask` tool to generate and pass a new `childNodeId`.
- [ ] Ensure `Agent.process` correctly initializes the tracer with the incoming `nodeId` from EventBridge.

## 4. Visualization (Dashboard)
- [ ] Update `getTrace` API to query the table using the Partition Key (`traceId`) to retrieve **all** nodes in the graph.
- [ ] Refactor `PathVisualizer.tsx` to render a Directed Acyclic Graph (DAG) instead of a vertical list.
- [ ] Add visual indicators for parallel execution branches.
