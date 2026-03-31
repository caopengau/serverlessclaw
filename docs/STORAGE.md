> **Navigation**: [← Index Hub](./INDEX.md)

## Multi-Modal Storage Flow

When a user sends media (photos, documents, voice) via Telegram, the system bridges it to internal storage before agent processing.

```text
User Event      Webhook         Telegram API      Staging Bucket (S3)    SuperClaw (Agent)
    |              |                |                    |                      |
    +------------->|                |                    |                      |
    |  (Media Msg) |                |                    |                      |
    |              +--------------->|                    |                      |
    |              | (Get File URL) |                    |                      |
    |              |<---------------+                    |                      |
    |              |                |                    |                      |
    |              +--------------->|                    |                      |
    |              |  (Download)    |                    |                      |
    |              |<---------------+                    |                      |
    |              |                |                    |                      |
    |              +------------------------------------>|                      |
    |              |         (S3 Upload / lifecycle)     |                      |
    |              |                |                    |                      |
    |              +----------------------------------------------------------->|
    |              |                |                    |    (Process w/ URL)  |
```

- **S3 Staging**: Media is stored in the `StagingBucket` with a 30-day TTL lifecycle policy.
- **Vision Integration**: For small images, the Webhook provides a Base64 string directly to the agent's Vision context for zero-latency analysis.

### Outbound Multi-Modal Flow

When an agent generates a result containing media (e.g., a Python chart or a screenshot), it is relayed via the AgentBus to the Notifier and the Dashboard.

```text
SuperClaw (Agent)      AgentBus (EB)         Notifier (Lambda)      Telegram API       Dashboard (IoT)
      |                    |                     |                     |                  |
      +------------------->|                     |                     |                  |
      | (OUTBOUND_MESSAGE) |                     |                     |                  |
      |  w/ Attachments    +-------------------->|                     |                  |
      |                    |                     |                     |                  |
      |                    |                     +-------------------->|                  |
      |                    |                     |   (Store in DDB)    |                  |
      |                    |                     |                     |                  |
      |                    |                     +-------------------->|                  |
      |                    |                     |    (sendMedia)      |                  |
      |                    |                     |                     +----------------->|
      |                    |                     |                     |   (MQTT Push)    |
```

- **Persistence**: Outbound attachments are stored in the `MemoryTable` along with the message text, enabling long-term recall and dashboard rendering.
- **Rendering**: The Dashboard component automatically detects attachment types and renders previews or download links based on MIME types.

```

---
```
