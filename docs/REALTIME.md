To ensure the **ClawCenter Dashboard** receives instantaneous updates without polling, Serverless Claw uses a **Real-time Bridge** pattern over AWS IoT Core and MQTT.

### Bridge Implementation
The system utilizes a specialized EventBridge-to-IoT bridge (`core/handlers/bridge.ts`) that listens for `AgentBus` signals and routes them to session-specific MQTT topics.
- **Client**: Uses `IoTDataPlaneClient` from the AWS SDK v3.
- **Routing**: Events are dynamically routed to `users/{userId}/sessions/{sessionId}/signal`.
- **Latency**: Sub-100ms delivery from agent execution to dashboard UI.

## Signaling Architecture

```text
 [ Agent / Handler ]
          |
   (Publish Event)
   (CHUNK, TASK_COMPLETED, etc.)
          |
          v
 [ AgentBus (EventBridge) ]
          |
      (Rule Match)
          |
          v
 [ Realtime Bridge (Lambda) ]
          |
   (re-wrap & publish)
          |
          v
 [ AWS IoT Core (MQTT) ] ----> [ Dashboard (React Flow) ]
  (Topic: users/{id}/signal)      (Instant Neural Pulse)
```

## Key Components

1. **IoT Core (MQTT)**: Acts as the low-latency message broker for telemetry and signal data.
2. **Real-time Bridge**: A lightweight Lambda that reformats internal EventBridge events into MQTT-compatible payloads.
3. **MQTT Bridge (ClawCenter)**: The Next.js dashboard uses `mqtt` (v5) to maintain a persistent WebSocket connection to IoT Core.

## Real-time Streaming (CHUNK)
To minimize "Time-to-First-Token" (TTFT), agents can emit partial response chunks during the reasoning process.

1. **Streaming Initiation**: When the Dashboard sends a message with `stream=true`, the SuperClaw initiates a streaming LLM call.
2. **Chunk Emission**: As the LLM yields tokens, the agent emits a `CHUNK` event to the `AgentBus` for every few tokens.
3. **IoT Relay**: The `RealtimeBridge` forwards these chunks to the dashboard's MQTT topic.
4. **UI Reconciliation**: The Dashboard appends chunks to the active message based on the `messageId`, providing a smooth "typing" experience.

## Performance
- **Latency**: Sub-100ms from Lambda execution to Dashboard visualization.
- **Scale**: Leverages AWS IoT Core's managed scale to support multiple concurrent dashboard operators.
