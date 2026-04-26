import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EVOLUTION_METRICS } from './evolution-metrics';
import { emitMetrics } from './metrics';

vi.mock('./metrics', () => ({
  emitMetrics: vi.fn().mockResolvedValue({}),
  METRICS: {
    lockAcquired: vi.fn().mockReturnValue({ MetricName: 'LockAcquired' }),
  },
}));

describe('EVOLUTION_METRICS ROI & Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits ToolExecutionCount and ToolExecutionDuration metrics', async () => {
    EVOLUTION_METRICS.recordToolExecution('test_tool', true, 500, { orgId: 'org_123' });

    expect(emitMetrics).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          MetricName: 'ToolExecutionCount',
          Dimensions: expect.arrayContaining([{ Name: 'ToolName', Value: 'test_tool' }]),
        }),
        expect.objectContaining({
          MetricName: 'ToolExecutionDuration',
          Value: 500,
        }),
      ])
    );
  });

  it('emits ToolROIValue and ToolROICost metrics', async () => {
    EVOLUTION_METRICS.recordToolROI('test_tool', 1.0, 100, { orgId: 'org_123' });

    expect(emitMetrics).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          MetricName: 'ToolROIValue',
          Value: 1.0,
        }),
        expect.objectContaining({
          MetricName: 'ToolROICost',
          Value: 100,
        }),
      ])
    );
  });
});
