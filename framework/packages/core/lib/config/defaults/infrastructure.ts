export const INFRASTRUCTURE_DEFAULTS = {
  MCP_HUB_TIMEOUT_MS: {
    code: 5000,
    hotSwappable: true,
    configKey: 'mcp_hub_timeout_ms',
    description: 'Timeout for MCP hub connections.',
  },
  FEATURE_FLAGS_ENABLED: {
    code: true,
    hotSwappable: true,
    configKey: 'feature_flags_enabled',
    description: 'Global kill switch for feature flags.',
  },
  ALERT_ERROR_RATE_THRESHOLD: {
    code: 0.3,
    hotSwappable: true,
    configKey: 'alert_error_rate_threshold',
    description: 'Error rate threshold for agent alerting.',
  },
  ALERT_DLQ_THRESHOLD: {
    code: 10,
    hotSwappable: true,
    configKey: 'alert_dlq_threshold',
    description: 'DLQ event count threshold for alerting.',
  },
  ALERT_TOKEN_ANOMALY_MULTIPLIER: {
    code: 3.0,
    hotSwappable: true,
    configKey: 'alert_token_anomaly_multiplier',
    description: 'Alert if tokens exceed this multiplier.',
  },
  GLOBAL_TOKEN_BUDGET: {
    code: 1000000,
    hotSwappable: true,
    configKey: 'global_token_budget',
    description: 'Maximum cumulative tokens allowed per execution trace.',
  },
  SESSION_LOCK_HEARTBEAT_MS: {
    code: 60000,
    hotSwappable: true,
    configKey: 'session_lock_heartbeat_ms',
    description: 'Interval for renewing session locks.',
  },
  TIE_BREAK_TIMEOUT_MS: {
    code: 900000,
    hotSwappable: true,
    configKey: 'tie_break_timeout_ms',
    description: 'Timeout for multi-party collaboration conflicts.',
  },
};
