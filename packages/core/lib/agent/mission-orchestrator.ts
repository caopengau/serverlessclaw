import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';
import { Agent } from '../agent';
import { Mission, MissionStatus } from '../types/mission';
import { decomposePlan } from './decomposer';
import { AgentStatus } from '../types/agent';
import { MissionControlRegistry } from '../registry/mission-control';

export interface MissionOptions {
  metadata?: Record<string, any>;
  maxSteps?: number;
}

/**
 * Mission Orchestrator
 * Implements SC-3.1: Intent-based Mission Orchestrator.
 */
export class MissionOrchestrator {
  constructor(private agent: Agent) {}

  /**
   * Creates and starts a new mission based on a high-level intent.
   */
  async createMission(
    userId: string,
    workspaceId: string,
    intent: string,
    options: MissionOptions = {}
  ): Promise<Mission> {
    logger.info(
      `[MissionOrchestrator] Creating mission for intent: "${intent}" (User: ${userId}, WS: ${workspaceId})`
    );

    const missionId = `mission-${uuidv4().substring(0, 8)}`;

    // 1. Initialize Mission State
    const mission: Mission = {
      id: missionId,
      workspaceId,
      userId,
      intent,
      status: MissionStatus.PLANNING,
      steps: [],
      context: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: options.metadata,
    };

    await MissionControlRegistry.signal({
      type: 'strategy_update',
      agentId: this.agent.id,
      traceId: missionId,
      workspaceId,
      payload: { mission, message: 'Mission initialized. Starting planning phase...' },
    });

    // 2. Planning Phase: Decompose Intent into Steps
    // In a real implementation, we might first ask the LLM to create a plan string.
    // For now, we use the intent as the plan and let the decomposer break it down.
    const decomposition = await decomposePlan(intent, missionId, [], {
      workspaceId,
      maxSubTasks: options.maxSteps ?? 5,
    });

    mission.steps = decomposition.subTasks.map((sub) => ({
      id: sub.subTaskId,
      task: sub.task,
      agentId: sub.agentId as any,
      status: AgentStatus.IDLE,
      dependencies: sub.dependencies.map((d) => `${missionId}-sub-${d}`),
    }));

    mission.status = MissionStatus.EXECUTING;
    mission.updatedAt = Date.now();

    await MissionControlRegistry.signal({
      type: 'strategy_update',
      agentId: this.agent.id,
      traceId: missionId,
      workspaceId,
      payload: { mission, message: 'Plan decomposed. Entering execution phase.' },
    });

    return mission;
  }

  /**
   * Executes a mission.
   * This is a simplified version of DAG execution.
   */
  async executeMission(mission: Mission): Promise<Mission> {
    logger.info(`[MissionOrchestrator] Executing mission: ${mission.id}`);

    // Simple sequential execution for now (can be expanded to parallel using DAGExecutor logic)
    for (const step of mission.steps) {
      if (step.status === AgentStatus.COMPLETED) continue;

      step.status = AgentStatus.BUSY;
      step.startTime = Date.now();

      await MissionControlRegistry.signal({
        type: 'progress_update',
        agentId: this.agent.id,
        traceId: mission.id,
        workspaceId: mission.workspaceId,
        payload: { mission, currentStepId: step.id, message: `Executing step: ${step.task}` },
      });

      try {
        // Here we would dispatch the task to the appropriate agent.
        // For SC-3.1, we simulate the execution.
        logger.info(`[MissionOrchestrator] Dispatching step ${step.id} to ${step.agentId}`);

        // Simulation of processing
        const response = await this.agent.process(mission.userId, step.task, {
          workspaceId: mission.workspaceId,
          traceId: step.id,
        });

        step.status = AgentStatus.COMPLETED;
        step.result = response.responseText;
        step.endTime = Date.now();

        // Update mission context with step result
        mission.context[step.id] = step.result;
      } catch (err: any) {
        logger.error(`[MissionOrchestrator] Step ${step.id} failed:`, err);
        step.status = AgentStatus.ERROR;
        step.error = err.message;
        mission.status = MissionStatus.FAILED;
        break;
      }

      mission.updatedAt = Date.now();
    }

    if (mission.status !== MissionStatus.FAILED) {
      mission.status = MissionStatus.COMPLETED;
      mission.completedAt = Date.now();
    }

    await MissionControlRegistry.signal({
      type: 'milestone_reached',
      agentId: this.agent.id,
      traceId: mission.id,
      workspaceId: mission.workspaceId,
      payload: { mission, message: `Mission ${mission.status.toUpperCase()}` },
    });

    return mission;
  }
}
