import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRegistry } from './registry';
import { EvolutionMode } from './types/agent';
import { ConfigManager } from './registry/config';

vi.mock('./registry/config', () => ({
  ConfigManager: {
    getRawConfig: vi.fn(),
  },
  defaultDocClient: {},
}));

vi.mock('./backbone', () => ({
  BACKBONE_REGISTRY: {
    test_agent: {
      id: 'test_agent',
      name: 'Test Agent',
      systemPrompt: 'prompt',
      enabled: true,
      tools: [],
    },
  },
}));

describe('AgentRegistry Default EvolutionMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should default to HITL if not specified, according to safety principles', async () => {
    vi.mocked(ConfigManager.getRawConfig).mockResolvedValue({}); // No dynamic config

    const config = await AgentRegistry.getAgentConfig('test_agent');

    // THE PRINCIPLE SAYS IT SHOULD BE HITL
    // BUT THE CODE CURRENTLY SAYS AUTO
    expect(config?.evolutionMode).toBe(EvolutionMode.HITL);
  });
});
