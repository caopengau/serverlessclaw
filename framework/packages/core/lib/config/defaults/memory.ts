export const MEMORY_DEFAULTS = {
  TRACE_RETENTION_DAYS: {
    code: 30,
    hotSwappable: false,
    configKey: null,
    description: 'Days to retain agent execution traces.',
  },
  MESSAGE_RETENTION_DAYS: {
    code: 30,
    hotSwappable: false,
    configKey: null,
    description: 'Days to retain conversation messages.',
  },
  FACTS_RETENTION_DAYS: {
    code: 365,
    hotSwappable: false,
    configKey: null,
    description: 'Days to retain distilled memory facts.',
  },
  LESSONS_RETENTION_DAYS: {
    code: 90,
    hotSwappable: false,
    configKey: null,
    description: 'Days to retain tactical lessons.',
  },
  SUMMARY_RETENTION_DAYS: {
    code: 30,
    hotSwappable: false,
    configKey: null,
    description: 'Days to retain conversation summaries.',
  },
  GAPS_RETENTION_DAYS: {
    code: 60,
    hotSwappable: true,
    configKey: 'gaps_retention_days',
    description: 'Days to retain strategic gaps before TTL expiry.',
  },
  REPUTATION_RETENTION_DAYS: {
    code: 365,
    hotSwappable: true,
    configKey: 'reputation_retention_days',
    description: 'Days to retain reputation and trust score history.',
  },
  CACHE_TTL_USER_DATA_MS: {
    code: 300000,
    hotSwappable: true,
    configKey: 'cache_ttl_user_data_ms',
    description: 'Cache TTL for user-specific data.',
  },
  CACHE_TTL_CONVERSATION_MS: {
    code: 120000,
    hotSwappable: true,
    configKey: 'cache_ttl_conversation_ms',
    description: 'Cache TTL for conversation data.',
  },
  CACHE_TTL_GLOBAL_MS: {
    code: 900000,
    hotSwappable: true,
    configKey: 'cache_ttl_global_ms',
    description: 'Cache TTL for global/system-wide data.',
  },
  CACHE_TTL_SEARCH_MS: {
    code: 180000,
    hotSwappable: true,
    configKey: 'cache_ttl_search_ms',
    description: 'Cache TTL for search results.',
  },
  STAGING_RETENTION_DAYS: {
    code: 30,
    hotSwappable: true,
    configKey: 'staging_retention_days',
    description: 'Days to retain temporary files in the staging bucket.',
  },
};
