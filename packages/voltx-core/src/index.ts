import { AgentRegistry } from '@serverlessclaw/core';
import { 
  AgentCategory, 
  ConnectionProfile, 
  ReasoningProfile, 
  IAgentConfig,
  EvolutionMode
} from '@serverlessclaw/core';
import { 
  ENERGY_AGGREGATOR_SYSTEM_PROMPT, 
  MARKET_TRADER_SYSTEM_PROMPT 
} from './prompts';

export const VOLTX_AGENTS: Record<string, IAgentConfig> = {
  'energy-aggregator': {
    id: 'energy-aggregator',
    name: 'Aggregation Agent',
    systemPrompt: ENERGY_AGGREGATOR_SYSTEM_PROMPT,
    description: 'Coordinates and groups distributed energy resources.',
    category: AgentCategory.SYSTEM,
    icon: 'Share2',
    enabled: true,
    isBackbone: true,
    parallelToolCalls: false,
    maxIterations: 10,
    evolutionMode: EvolutionMode.HITL,
    reasoningProfile: ReasoningProfile.STANDARD,
    tools: [],
    connectionProfile: [ConnectionProfile.MEMORY, ConnectionProfile.BUS],
  },
  'market-trader': {
    id: 'market-trader',
    name: 'Trading Agent',
    systemPrompt: MARKET_TRADER_SYSTEM_PROMPT,
    description: 'Handles electricity spot market bidding and arbitrage.',
    category: AgentCategory.SYSTEM,
    icon: 'TrendingUp',
    enabled: true,
    isBackbone: true,
    parallelToolCalls: false,
    maxIterations: 10,
    evolutionMode: EvolutionMode.HITL,
    reasoningProfile: ReasoningProfile.HIGH_PERFORMANCE,
    tools: [],
    connectionProfile: [ConnectionProfile.MEMORY, ConnectionProfile.BUS, ConnectionProfile.TRACE],
  },
};

/**
 * Initializes VoltX specific agents.
 */
export function initVoltX() {
  AgentRegistry.registerAppAgents(VOLTX_AGENTS);
}

export function bootstrap() {
  initVoltX();
}
