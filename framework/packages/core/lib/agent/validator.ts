import { IAgentConfig } from '../types/index';
import { validateRequiredFields } from '../utils/validation';

/**
 * Validates that an IAgentConfig has all required fields populated.
 *
 * @param config - The agent configuration to validate.
 * @param agentType - The type identifier of the agent, used for error messages.
 * @throws Error if config is undefined or missing required fields.
 */
export function validateAgentConfig(config: IAgentConfig | undefined, agentType: string): void {
  validateRequiredFields(config, ['id', 'name', 'enabled'], `Agent config for '${agentType}'`);

  // Principle 14: Selection Integrity - Must check enabled === true
  if (config!.enabled !== true) {
    throw new Error(
      `Agent '${agentType}' is currently DISABLED. ` +
        `Operation rejected to satisfy Principle 14 (Selection Integrity).`
    );
  }

  // systemPrompt is mandatory for LLM agents (default type)
  if (!config!.systemPrompt) {
    throw new Error(`Agent config for '${agentType}' is missing systemPrompt.`);
  }
}
