import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDlqRoute } from './dlq-handler';
import { EventType } from '../../lib/types/agent';

const reportHealthIssue = vi.fn();

vi.mock('../../lib/lifecycle/health', () => ({
  reportHealthIssue: (...args: unknown[]) => reportHealthIssue(...args),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('handleDlqRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('suppresses health re-report for recursion-rerouted system_health_report', async () => {
    await handleDlqRoute(
      {
        detailType: EventType.SYSTEM_HEALTH_REPORT,
        errorMessage: 'Recursion limit exceeded',
        userId: 'SYSTEM',
        traceId: 'trace-loop',
        originalEvent: { x: 1 },
      },
      EventType.DLQ_ROUTE
    );

    expect(reportHealthIssue).not.toHaveBeenCalled();
  });

  it('reports health issue with workspaceId scoping for failed events', async () => {
    await handleDlqRoute(
      {
        detailType: EventType.DASHBOARD_FAILURE_DETECTED,
        errorMessage: 'handler import failed',
        userId: 'USER_123',
        traceId: 'trace-1',
        workspaceId: 'WS_XYZ',
        teamId: 'TEAM_A',
        staffId: 'STAFF_1',
        originalEvent: { dashboard: true },
      },
      EventType.DLQ_ROUTE
    );

    expect(reportHealthIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'WS_XYZ',
        userId: 'USER_123',
        traceId: 'trace-1',
        context: expect.objectContaining({
          teamId: 'TEAM_A',
          staffId: 'STAFF_1',
        }),
      })
    );
  });
});
