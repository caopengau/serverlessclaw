import {
  AgentRegistry,
  AgentCategory,
  ConnectionProfile,
  ReasoningProfile,
  IAgentConfig,
  EvolutionMode,
  MissionControlRegistry,
  IMissionObserver,
  MissionSignal,
} from '@serverlessclaw/core';
import { ENERGY_AGGREGATOR_SYSTEM_PROMPT, MARKET_TRADER_SYSTEM_PROMPT } from './prompts';

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
 * VoltX Mission Observer.
 * Monitors agent progress and translates it into energy-specific signals for the dashboard.
 */
export class VoltXMissionObserver implements IMissionObserver {
  async onSignal(signal: MissionSignal) {
    if (signal.type === 'milestone_reached') {
      console.log(`[VoltX] Energy Milestone Reached: ${signal.payload.milestone}`);
      // Here you could trigger energy-specific side effects,
      // like updating a physical device state or settling a trade.
    }
  }
}

/**
 * Initializes VoltX specific agents and registries.
 */
export function initVoltX() {
  // Register domain agents
  AgentRegistry.registerAppAgents(VOLTX_AGENTS);

  // Register mission observers
  MissionControlRegistry.register(new VoltXMissionObserver());

  // Pro-tip: You can also register ToolMiddleware here to enforce
  // energy-specific safety guardrails (e.g., price caps, capacity limits).
}

export function bootstrap() {
  initVoltX();
}
