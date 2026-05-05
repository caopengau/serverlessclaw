import { IToolDefinition } from '../../lib/types/index';
import { agentSchema } from './definitions/agent';
import { memorySchema } from './definitions/memory';
import { gapSchema } from './definitions/gaps';
import { skillSchema } from './definitions/skills';
import { researchSchema } from './definitions/research';
import { mcpSchema } from './definitions/mcp';
import { metadataSchema } from './definitions/metadata';
import { configSchema } from './schema-config';

/**
 * Knowledge Domain Tool Definitions
 * Aggregates specialized tool definitions from sub-modules.
 */
export const knowledgeSchema: Record<string, IToolDefinition> = {
  ...agentSchema,
  ...memorySchema,
  ...gapSchema,
  ...skillSchema,
  ...researchSchema,
  ...mcpSchema,
  ...metadataSchema,
  ...configSchema,
};
