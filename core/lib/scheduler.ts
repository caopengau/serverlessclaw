import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
  GetScheduleCommand,
  ListSchedulesCommand,
  FlexibleTimeWindowMode,
  ActionAfterCompletion,
} from '@aws-sdk/client-scheduler';
import { logger } from './logger';

const scheduler = new SchedulerClient({});

/**
 * Service for managing dynamic, goal-oriented schedules using AWS EventBridge Scheduler.
 */
export class DynamicScheduler {
  /**
   * Upserts a dynamic schedule that triggers a proactive heartbeat.
   *
   * @param name - Unique name for the schedule (e.g., 'planner-strategic-review').
   * @param payload - Data to be delivered when the schedule fires.
   * @param expression - Schedule expression (e.g., 'rate(1 day)', 'at(2026-03-15T12:00:00)', 'cron(0 12 * * ? *)').
   * @param description - Optional description of the goal.
   */
  static async upsertSchedule(
    name: string,
    payload: Record<string, unknown>,
    expression: string,
    description?: string
  ): Promise<void> {
    const roleArn = process.env.SCHEDULER_ROLE_ARN;
    const targetArn = process.env.HEARTBEAT_HANDLER_ARN;

    if (!roleArn || !targetArn) {
      throw new Error('SCHEDULER_ROLE_ARN or HEARTBEAT_HANDLER_ARN not configured in environment.');
    }

    logger.info(`Upserting schedule: ${name} with expression: ${expression}`);

    try {
      await scheduler.send(
        new CreateScheduleCommand({
          Name: name,
          ScheduleExpression: expression,
          Description:
            description || `Dynamic goal-oriented schedule for ${payload.agentId || 'system'}`,
          FlexibleTimeWindow: { Mode: FlexibleTimeWindowMode.OFF },
          Target: {
            Arn: targetArn,
            RoleArn: roleArn,
            Input: JSON.stringify(payload),
          },
          ActionAfterCompletion: expression.startsWith('at(')
            ? ActionAfterCompletion.DELETE
            : ActionAfterCompletion.NONE,
          State: 'ENABLED',
        })
      );
    } catch (error: any) {
      if (error.name === 'ConflictException') {
        // Handle update by deleting and recreating (Scheduler doesn't have UpdateSchedule in all SDK versions,
        // or it's often easier to replace for simple dynamic tasks)
        logger.info(`Schedule ${name} already exists, replacing...`);
        await this.removeSchedule(name);
        await this.upsertSchedule(name, payload, expression, description);
      } else {
        logger.error(`Failed to create schedule ${name}:`, error);
        throw error;
      }
    }
  }

  /**
   * Removes a dynamic schedule.
   *
   * @param name - Unique name of the schedule to delete.
   */
  static async removeSchedule(name: string): Promise<void> {
    logger.info(`Removing schedule: ${name}`);
    try {
      await scheduler.send(new DeleteScheduleCommand({ Name: name }));
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        logger.warn(`Schedule ${name} not found, skipping deletion.`);
      } else {
        logger.error(`Failed to delete schedule ${name}:`, error);
        throw error;
      }
    }
  }

  /**
   * Lists all dynamic schedules managed by the system.
   */
  static async listSchedules(namePrefix?: string): Promise<any[]> {
    try {
      const response = await scheduler.send(
        new ListSchedulesCommand({
          NamePrefix: namePrefix,
        })
      );
      return response.Schedules || [];
    } catch (error) {
      logger.error('Failed to list schedules:', error);
      throw error;
    }
  }

  /**
   * Retrieves details of a specific schedule.
   */
  static async getSchedule(name: string): Promise<any> {
    try {
      const response = await scheduler.send(new GetScheduleCommand({ Name: name }));
      return response;
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') return null;
      throw error;
    }
  }
}
