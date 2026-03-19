import { ResponseFormat } from '../types/index';

/**
 * Standard structured output schema for agent coordination and deterministic state transitions.
 * This schema helps LLMs generate parseable JSON for tool orchestration.
 */
export const DEFAULT_SIGNAL_SCHEMA: ResponseFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'agent_signal',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['SUCCESS', 'FAILED', 'CONTINUE', 'REOPEN'] },
        message: { type: 'string' },
        data: { type: 'object', additionalProperties: true },
        coveredGapIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['status', 'message'],
      additionalProperties: false,
    },
  },
};
