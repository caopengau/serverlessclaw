import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEmitEvent = vi.fn();

vi.mock('./utils/bus', () => ({
  emitEvent: (...args: unknown[]) => mockEmitEvent(...args),
}));

import { Alerting } from './alerting';

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('Alerting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmitEvent.mockResolvedValue({ success: true });
  });

  it('should emit OUTBOUND_MESSAGE for high token usage', async () => {
    await Alerting.alertHighTokenUsage('coder', 50000, 10000);

    expect(mockEmitEvent).toHaveBeenCalledTimes(1);
    const [source, eventType, detail] = mockEmitEvent.mock.calls[0];
    expect(source).toBe('system.alerting');
    expect(eventType).toBe('outbound_message');
    expect(detail.userId).toBe('ADMIN');
    expect(detail.message).toContain('50000');
  });

  it('should emit OUTBOUND_MESSAGE for circuit breaker open', async () => {
    await Alerting.alertCircuitBreakerOpen('deploy');

    expect(mockEmitEvent).toHaveBeenCalledTimes(1);
    const detail = mockEmitEvent.mock.calls[0][2];
    expect(detail.message).toContain('deploy');
    expect(detail.message).toContain('OPEN');
  });

  it('should emit OUTBOUND_MESSAGE for DLQ overflow', async () => {
    await Alerting.alertDLQOverflow(25);

    expect(mockEmitEvent).toHaveBeenCalledTimes(1);
    const detail = mockEmitEvent.mock.calls[0][2];
    expect(detail.message).toContain('25');
  });

  it('should emit OUTBOUND_MESSAGE for high error rate', async () => {
    await Alerting.alertHighErrorRate('coder', 0.45);

    expect(mockEmitEvent).toHaveBeenCalledTimes(1);
    const detail = mockEmitEvent.mock.calls[0][2];
    expect(detail.message).toContain('45.0%');
  });

  it('should not throw when emitEvent fails', async () => {
    mockEmitEvent.mockRejectedValueOnce(new Error('EB down'));
    await expect(Alerting.alertDLQOverflow(5)).resolves.toBeUndefined();
  });
});
