To ensure the **ClawCenter Dashboard** receives instantaneous updates without polling, Serverless Claw uses a **Real-time Streaming** pattern over AWS IoT Core and MQTT.

We have adopted the [AG-UI (Agent-User Interaction) Protocol](https://docs.ag-ui.com/) to standardize our streaming payload, ensuring interoperability with the wider agentic ecosystem.

### Direct Publish Implementation

To minimize "Time-to-First-Token" (TTFT), agents emit partial response chunks during the reasoning process directly to IoT Core, skipping EventBridge for streaming tokens.

- **Client**: Uses `IoTDataPlaneClient` from the AWS SDK v3 (`core/lib/utils/realtime.ts`).
- **Routing**: Events are dynamically routed to `users/{userId}/sessions/{sessionId}/signal`.
- **Latency**: Sub-100ms delivery from agent execution to dashboard UI.

## Signaling Architecture

```text
 [ Agent / Executor ]
          |
   (publishToRealtime)
   (TEXT_MESSAGE_CONTENT, TOOL_CALL_ARGS, etc.)
          |
          v
 [ AWS IoT Core (MQTT) ] ----> [ Dashboard (React Flow) ]
  (Topic: users/{id}/signal)      (Instant Neural Pulse)
```

## Key Components

1. **IoT Core (MQTT)**: Acts as the low-latency message broker for telemetry and signal data.
2. **Direct Publisher**: The agent execution loop directly uses `@aws-sdk/client-iot-data-plane` to push chunks to MQTT topics.
3. **MQTT Bridge (ClawCenter)**: The Next.js dashboard uses `mqtt` (v5) to maintain a persistent WebSocket connection to IoT Core.
4. **EventBridge Relay (Fallback)**: Non-streaming system events (`TASK_COMPLETED`, `SYSTEM_HEALTH_REPORT`) still traverse EventBridge and are bridged to IoT Core via `core/handlers/bridge.ts`.

## Real-time Streaming (AG-UI Protocol)

When the Dashboard sends a message with `stream=true`, the SuperClaw initiates a streaming LLM call.

1. **Chunk Emission**: As the LLM yields tokens, the agent emits `TEXT_MESSAGE_CONTENT` events directly to IoT Core.
2. **UI Reconciliation**: The Dashboard appends chunks to the active message based on the `messageId`, providing a smooth "typing" experience.

### 5. Channel Adapters (Fan-Out)

Instead of hardcoding API requests to a single platform, agents emit an `OUTBOUND_MESSAGE` event onto the AgentBus.

- **Notifier Handler**: A dedicated lightweight Lambda (`core/handlers/notifier.ts`) listens to these events.
- **Multi-Channel**: The Notifier reads user preferences from the `ConfigTable` and fans the message out to the appropriate adapters (Telegram, Slack).
