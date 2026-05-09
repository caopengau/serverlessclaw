import { z } from 'zod';
import { IToolDefinition, ToolType } from '../../../lib/types/index';

export const skillSchema: Record<string, IToolDefinition> = {
  discoverSkills: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'discoverSkills',
    description: 'Searches the project for matching skill definitions.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query or keyword (optional).' },
      },
      required: [],
      additionalProperties: false,
    },
    connectionProfile: ['storage'],
  },
  installSkill: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'installSkill',
    description: 'Installs a specific discovered skill for an agent.',
    parameters: {
      type: 'object',
      properties: {
        skillName: { type: 'string', description: 'Name of the skill to install.' },
        agentId: { type: 'string', description: 'ID of the agent (e.g., coder).' },
      },
      required: ['skillName', 'agentId'],
      additionalProperties: false,
    },
    connectionProfile: ['bus'],
  },
  uninstallSkill: {
    type: ToolType.FUNCTION,
    argSchema: z.any(),
    requiresApproval: false,
    requiredPermissions: [],
    name: 'uninstallSkill',
    description: 'Removes a previously installed skill from an agent.',
    parameters: {
      type: 'object',
      properties: {
        skillName: { type: 'string', description: 'Name of the skill to remove.' },
        agentId: { type: 'string', description: 'ID of the agent.' },
      },
      required: ['skillName', 'agentId'],
      additionalProperties: false,
    },
    connectionProfile: ['bus'],
  },
};
