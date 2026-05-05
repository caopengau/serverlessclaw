import { IToolDefinition } from '../../lib/types/index';
import { gitSchema } from './definitions/git';
import { healthSchema } from './definitions/health';
import { uiSchema } from './definitions/ui';
import { configSchema } from './definitions/config';
import { validationSchema } from './definitions/validation';
import { workflowSchema } from './definitions/workflow';
import { governanceSchema } from './definitions/governance';
import { reputationSchema } from './definitions/reputation';

/**
 * System Domain Tool Definitions
 * Aggregates specialized tool definitions from sub-modules.
 */
export const systemSchema: Record<string, IToolDefinition> = {
  ...gitSchema,
  ...healthSchema,
  ...uiSchema,
  ...configSchema,
  ...validationSchema,
  ...workflowSchema,
  ...governanceSchema,
  ...reputationSchema,
};
