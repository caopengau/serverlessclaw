export const BUS_DEFAULTS = {
  EB_MAX_RETRIES: {
    code: 3,
    hotSwappable: false,
    configKey: null,
    description: 'Maximum retries for EventBridge emit failures.',
  },
  EB_INITIAL_BACKOFF_MS: {
    code: 100,
    hotSwappable: false,
    configKey: null,
    description: 'Initial backoff time for EventBridge retries.',
  },
  EVENT_CIRCUIT_THRESHOLD: {
    code: 5,
    hotSwappable: true,
    configKey: 'event_circuit_threshold',
    description: 'Failures for an event type before opening the circuit.',
  },
  EVENT_CIRCUIT_TIMEOUT_MS: {
    code: 60000,
    hotSwappable: true,
    configKey: 'event_circuit_timeout_ms',
    description: 'Duration an event circuit remains open before reset.',
  },
  EVENT_RATE_BUCKET_CAPACITY: {
    code: 10,
    hotSwappable: true,
    configKey: 'event_rate_bucket_capacity',
    description: 'Maximum burst capacity for a specific event type.',
  },
  EVENT_RATE_BUCKET_REFILL_MS: {
    code: 1000,
    hotSwappable: true,
    configKey: 'event_rate_bucket_refill_ms',
    description: 'Interval at which the event rate bucket refills.',
  },
  EVENT_MAX_RETRY_COUNT: {
    code: 5,
    hotSwappable: true,
    configKey: 'event_max_retry_count',
    description: 'Maximum number of retries for an event before it is sent to DLQ.',
  },
  EVENT_EXECUTION_TIMEOUT_MS: {
    code: 5000,
    hotSwappable: true,
    configKey: 'event_execution_timeout_ms',
    description: 'Internal timeout for event handler execution.',
  },
};
