// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { PresenceProvider, usePresence } from './PresenceProvider';
import { useRealtimeContext } from './RealtimeProvider';
import { useTenant } from './TenantProvider';

vi.mock('./RealtimeProvider', () => ({
  useRealtimeContext: vi.fn(),
}));

vi.mock('./TenantProvider', () => ({
  useTenant: vi.fn(),
}));

const TestComponent = () => {
  const { members, myPresence, updateStatus } = usePresence();
  return (
    <div>
      <div data-testid="my-status">{myPresence?.status}</div>
      <div data-testid="member-count">{members.length}</div>
      <button onClick={() => updateStatus('away')}>Go Away</button>
    </div>
  );
};

describe('PresenceProvider', () => {
  const mockSubscribe = vi.fn();
  const mockUnsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSubscribe.mockReturnValue(mockUnsubscribe);
    (useRealtimeContext as any).mockReturnValue({
      subscribe: mockSubscribe,
      isLive: true,
      userId: 'user-1',
    });
    (useTenant as any).mockReturnValue({
      activeWorkspaceId: 'ws-1',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('subscribes to presence and updates members', () => {
    render(
      <PresenceProvider>
        <TestComponent />
      </PresenceProvider>
    );

    expect(mockSubscribe).toHaveBeenCalledWith(['workspaces/ws-1/presence'], expect.any(Function));

    const handler = mockSubscribe.mock.calls[0][1];

    // Simulate incoming presence
    act(() => {
      handler('topic', { memberId: 'user-2', status: 'online' });
    });

    expect(screen.getByTestId('member-count')).toHaveTextContent('1');

    // Update existing member
    act(() => {
      handler('topic', { memberId: 'user-2', status: 'away' });
    });
    expect(screen.getByTestId('member-count')).toHaveTextContent('1');
  });

  it('cleans up stale members', () => {
    render(
      <PresenceProvider>
        <TestComponent />
      </PresenceProvider>
    );

    const handler = mockSubscribe.mock.calls[0][1];
    act(() => {
      handler('topic', { memberId: 'user-2', status: 'online' });
    });
    expect(screen.getByTestId('member-count')).toHaveTextContent('1');

    // Advance time by 61 seconds
    act(() => {
      vi.advanceTimersByTime(61000);
    });

    expect(screen.getByTestId('member-count')).toHaveTextContent('0');
  });

  it('updates my status', () => {
    render(
      <PresenceProvider>
        <TestComponent />
      </PresenceProvider>
    );

    act(() => {
      screen.getByText('Go Away').click();
    });

    expect(screen.getByTestId('my-status')).toHaveTextContent('away');
  });

  it('throws error outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow(
      'usePresence must be used within a PresenceProvider'
    );
    consoleSpy.mockRestore();
  });
});
