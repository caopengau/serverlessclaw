import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';
import { IAgent } from '../types/agent/behavior';
import { Mission, MissionStatus, MissionOptions } from '../types/mission';
import { decomposePlan } from './decomposer';
import { AgentStatus } from '../types/agent';
import { MissionControlRegistry } from '../registry/mission-control';
import { getNotificationManager } from '../services/notification-manager';
import { NotificationType, ResourceType } from '../types/notification';

/**
 * Mission Orchestrator
 * Implements SC-3.1: Intent-based Mission Orchestrator.
 * Handles mission lifecycle from planning to execution.
 */
export class MissionOrchestrator {
  /**
   * Initializes the orchestrator with a primary agent.
   * @param agent The agent responsible for processing mission steps.
   */
  constructor(private agent: IAgent) {}

  /**
   * Creates and starts a new mission based on a high-level intent.
   *
   * @param userId ID of the user initiating the mission.
   * @param workspaceId ID of the workspace where the mission resides.
   * @param intent High-level description of what the mission should achieve.
   * @param options Optional configuration for the mission.
   * @returns A Promise resolving to the initialized Mission object.
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
      participants: options.participants || [],
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
    const decomposition = await decomposePlan(intent, missionId, [], {
      workspaceId,
      maxSubTasks: options.maxSteps ?? 5,
    });

    mission.steps = decomposition.subTasks.map((sub) => ({
      id: sub.subTaskId,
      task: sub.task,
      agentId: sub.agentId as string,
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
   * Executes a mission by processing its steps.
   * Currently implements a sequential execution model.
   *
   * @param mission The mission object to execute.
   * @returns A Promise resolving to the updated Mission object.
   */
  async executeMission(mission: Mission): Promise<Mission> {
    logger.info(`[MissionOrchestrator] Executing mission: ${mission.id}`);

    // Simple sequential execution for now
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
        logger.info(`[MissionOrchestrator] Dispatching step ${step.id} to ${step.agentId}`);

        const response = await this.agent.process(mission.userId, step.task, {
          workspaceId: mission.workspaceId,
          traceId: step.id,
        });

        step.status = AgentStatus.COMPLETED;
        step.result = response.responseText;
        step.endTime = Date.now();

        // Update mission context with step result
        mission.context[step.id] = step.result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error(`[MissionOrchestrator] Step ${step.id} failed:`, errorMessage);
        step.status = AgentStatus.ERROR;
        step.error = errorMessage;
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

    // Notify the initiator human colleague and relevant colleagues
    try {
      const nm = getNotificationManager();
      const recipients = Array.from(new Set([mission.userId, ...(mission.participants || [])]));

      await Promise.all(
        recipients.map((recipientId) =>
          nm.createNotification({
            type: NotificationType.SYSTEM_ALERT,
            senderId: this.agent.id,
            senderName: `Agent ${this.agent.id}`,
            receiverId: recipientId,
            workspaceId: mission.workspaceId,
            content: `Mission "${mission.intent}" has been ${mission.status.toLowerCase()}.`,
            resourceId: mission.id,
            resourceType: ResourceType.MISSION,
          })
        )
      );
    } catch (e) {
      logger.error('[MissionOrchestrator] Failed to send mission notifications:', e);
    }

    return mission;
  }
}
