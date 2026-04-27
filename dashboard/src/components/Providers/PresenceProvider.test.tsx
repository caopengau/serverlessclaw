import React from 'react';
import { render, act } from '@testing-library/react';
import { vi } from 'vitest';
import { PresenceProvider, usePresence } from './PresenceProvider';

vi.mock('./RealtimeProvider', () => ({
  __esModule: true,
  RealtimeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useRealtimeContext: () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscribe: vi.fn((topics: string[], callback: (topic: string, payload: any) => void) => {
      // Simulate receiving a presence message
      setTimeout(() => {
        callback('workspaces/test-ws/presence', {
          'detail-type': 'presence',
          detail: {},
          memberId: 'agent-1',
          displayName: 'Test Agent',
          type: 'agent',
          status: 'online',
        });
      }, 0);
      return vi.fn(); // unsubscribe
    }),
    isLive: true,
    userId: 'user-1',
  }),
}));

vi.mock('./TenantProvider', () => ({
  __esModule: true,
  TenantProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTenant: () => ({
    activeWorkspaceId: 'test-ws',
  }),
}));

const TestComponent = () => {
  const { members, myPresence } = usePresence();
  return (
    <div>
      <div data-testid="my-id">{myPresence?.memberId}</div>
      <div data-testid="member-count">{members.length}</div>
      <div data-testid="member-name">{members[0]?.displayName}</div>
    </div>
  );
};

describe('PresenceProvider', () => {
  it('provides own presence and tracks other members', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let getByTestId: any;

    await act(async () => {
      const result = render(
        <PresenceProvider>
          <TestComponent />
        </PresenceProvider>
      );
      getByTestId = result.getByTestId;
    });

    expect(getByTestId('my-id').textContent).toBe('user-1');

    // Wait for mock subscription to trigger
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(getByTestId('member-count').textContent).toBe('1');
    expect(getByTestId('member-name').textContent).toBe('Test Agent');
  });
});
