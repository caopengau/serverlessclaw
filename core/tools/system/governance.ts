import { ITool, ToolResult } from '../../lib/types/index';
import { systemSchema as schema } from './schema';
import { proposeAutonomyUpdate as proposeLogic } from '../../lib/agent/tools/governance';

/**
 * Tool for SuperClaw to propose autonomy level updates (AUTO vs HITL).
 */
export const proposeAutonomyUpdate: ITool = {
  ...schema.proposeAutonomyUpdate,
  execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
    const result = await proposeLogic(args as Parameters<typeof proposeLogic>[0]);
    return {
      text: result,
      images: [],
      metadata: {},
      ui_blocks: [],
    };
  },
};
