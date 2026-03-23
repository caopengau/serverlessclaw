import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SCHEDULE_GOAL, CANCEL_GOAL, LIST_GOALS } from './scheduler';
import { DynamicScheduler } from '../lib/scheduler';

vi.mock('../lib/scheduler', () => ({
  DynamicScheduler: {
    upsertSchedule: vi.fn().mockResolvedValue(undefined),
    removeSchedule: vi.fn().mockResolvedValue(undefined),
    listSchedules: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../lib/utils/error', () => ({
  formatErrorMessage: vi.fn((err) => String(err)),
}));

describe('Scheduler Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scheduleGoal', () => {
    it('successfully schedules a goal', async () => {
      const args = {
        goalId: 'test-goal',
        task: 'test-task',
        agentId: 'coder',
        scheduleExpression: 'rate(1 hour)',
        metadata: { foo: 'bar' },
      };

      const result = await SCHEDULE_GOAL.execute(args);

      expect(DynamicScheduler.upsertSchedule).toHaveBeenCalledWith(
        'test-goal',
        {
          goalId: 'test-goal',
          task: 'test-task',
          agentId: 'coder',
          metadata: { foo: 'bar' },
          userId: 'SYSTEM',
        },
        'rate(1 hour)',
        'Proactive goal for coder: test-task'
      );
      expect(result).toContain('Successfully scheduled proactive goal "test-goal"');
    });

    it('handles errors during scheduling', async () => {
      vi.mocked(DynamicScheduler.upsertSchedule).mockRejectedValue(new Error('Failed!'));

      const result = await SCHEDULE_GOAL.execute({
        goalId: 'test-goal',
        task: 'test-task',
        agentId: 'coder',
        scheduleExpression: 'rate(1 hour)',
      });

      expect(result).toContain('Failed to schedule goal: Error: Failed!');
    });
  });

  describe('cancelGoal', () => {
    it('successfully cancels a goal', async () => {
      const result = await CANCEL_GOAL.execute({ goalId: 'test-goal' });

      expect(DynamicScheduler.removeSchedule).toHaveBeenCalledWith('test-goal');
      expect(result).toContain('Successfully cancelled proactive goal "test-goal"');
    });

    it('handles errors during cancellation', async () => {
      vi.mocked(DynamicScheduler.removeSchedule).mockRejectedValue(new Error('Failed to cancel'));

      const result = await CANCEL_GOAL.execute({ goalId: 'test-goal' });

      expect(result).toContain('Failed to cancel goal: Error: Failed to cancel');
    });
  });

  describe('listGoals', () => {
    it('returns message when no goals found', async () => {
      vi.mocked(DynamicScheduler.listSchedules).mockResolvedValue([]);

      const result = await LIST_GOALS.execute({});

      expect(result).toBe('No active proactive goals found.');
    });

    it('lists active goals', async () => {
      vi.mocked(DynamicScheduler.listSchedules).mockResolvedValue([
        { Name: 'goal1', State: 'ENABLED' },
        { Name: 'goal2', State: 'DISABLED' },
      ]);

      const result = await LIST_GOALS.execute({ namePrefix: 'goal' });

      expect(DynamicScheduler.listSchedules).toHaveBeenCalledWith('goal');
      expect(result).toContain('Active Proactive Goals:');
      expect(result).toContain('- goal1: (ENABLED)');
      expect(result).toContain('- goal2: (DISABLED)');
    });

    it('handles errors during listing', async () => {
      vi.mocked(DynamicScheduler.listSchedules).mockRejectedValue(new Error('Failed to list'));

      const result = await LIST_GOALS.execute({});

      expect(result).toContain('Failed to list goals: Error: Failed to list');
    });
  });
});
