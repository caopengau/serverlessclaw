import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MissionOrchestrator } from './mission-orchestrator';
import { Agent } from '../agent';
import { MissionStatus } from '../types/mission';
import { AgentStatus } from '../types/agent';

describe('MissionOrchestrator', () => {
  let mockAgent: any;
  let orchestrator: MissionOrchestrator;

  beforeEach(() => {
    mockAgent = {
      id: 'test-agent',
      process: vi.fn().mockResolvedValue({ responseText: 'Step completed' }),
    };
    orchestrator = new MissionOrchestrator(mockAgent as Agent);
  });

  it('should create a mission with decomposed steps', async () => {
    const intent = '### Goal: CODER\n1. Do thing A\n2. Do thing B';
    const mission = await orchestrator.createMission('user-1', 'ws-1', intent);

    expect(mission.intent).toBe(intent);
    expect(mission.status).toBe(MissionStatus.EXECUTING);
    expect(mission.steps.length).toBeGreaterThanOrEqual(1);
    expect(mission.steps[0].task).toContain('Do thing A');
  });

  it('should execute mission steps sequentially', async () => {
    const intent = 'Step 1\nStep 2';
    const mission = await orchestrator.createMission('user-1', 'ws-1', intent);
    const completedMission = await orchestrator.executeMission(mission);

    expect(completedMission.status).toBe(MissionStatus.COMPLETED);
    expect(completedMission.steps.every((s) => s.status === AgentStatus.COMPLETED)).toBe(true);
    expect(mockAgent.process).toHaveBeenCalled();
  });
});
