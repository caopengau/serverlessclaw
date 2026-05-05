export const CONTEXT_DEFAULTS = {
  CONTEXT_SAFETY_MARGIN: {
    code: 0.2,
    hotSwappable: true,
    configKey: 'context_safety_margin',
    description: 'Fraction of max context reserved for LLM response and safety buffer.',
  },
  CONTEXT_SUMMARY_TRIGGER_RATIO: {
    code: 0.8,
    hotSwappable: true,
    configKey: 'context_summary_trigger_ratio',
    description: 'Ratio of context usage that triggers history summarization.',
  },
  CONTEXT_SUMMARY_RATIO: {
    code: 0.3,
    hotSwappable: true,
    configKey: 'context_summary_ratio',
    description: 'Fraction of available context budget for compressed history (key facts).',
  },
  CONTEXT_ACTIVE_WINDOW_RATIO: {
    code: 0.7,
    hotSwappable: true,
    configKey: 'context_active_window_ratio',
    description: 'Fraction of available context budget for active message window.',
  },
};
