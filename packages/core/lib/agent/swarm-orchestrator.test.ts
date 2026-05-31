import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../types';
import type { AgentPayload } from '../types/agent';

vi.mock('../utils/agent-helpers', () => ({
  isTaskPaused: vi.fn(() => false),
}));

vi.mock('../registry/config', () => ({
  ConfigManager: {
    getRawConfig: vi.fn(async () => undefined),
  },
}));

vi.mock('../metrics', () => ({
  emitMetrics: vi.fn(async () => undefined),
  METRICS: {
    swarmDecomposed: vi.fn(() => ({ name: 'swarm.decomposed' })),
  },
}));

describe('handleSwarmDecomposition', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('skips decomposition for direct smoke tasks even when task text is long', async () => {
    const { handleSwarmDecomposition } = await import('./swarm-orchestrator');

    const longTask =
      'Edit only apps/dashboard/src/lib/api-handler.ts and apps/dashboard/src/lib/api-handler.test.ts. '.repeat(
        10
      );
    const payload: AgentPayload = {
      source: 'pipeline.evolution',
      userId: 'dashboard-user',
      traceId: 'trace-direct',
      taskId: 'task-direct',
      initiatorId: 'strategic-planner',
      depth: 1,
      sessionId: 'session-direct',
      task: longTask,
      workspaceId: 'default',
      userRole: UserRole.ADMIN,
      timestamp: Date.now(),
      metadata: {
        directSmokeTask: true,
        compactTask: true,
      },
      attachments: [],
      isContinuation: false,
    };

    const result = await handleSwarmDecomposition(longTask, payload, {
      traceId: 'trace-direct',
      sourceAgentId: 'coder',
      minLength: 400,
    });

    expect(result.wasDecomposed).toBe(false);
    expect(result.isPaused).toBe(false);
    expect(result.response).toBe(longTask);
  });
});
