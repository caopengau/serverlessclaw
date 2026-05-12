import { renderHook, waitFor } from '@testing-library/react';
import { UserProvider, useUser } from './UserProvider';
import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('UserProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('provides user data and isAdmin status when authenticated as admin', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          user: { userId: 'admin-1', role: 'admin', displayName: 'Admin User' },
        }),
    } as unknown as Response);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UserProvider>{children}</UserProvider>
    );

    const { result } = renderHook(() => useUser(), { wrapper });

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user?.userId).toBe('admin-1');
    expect(result.current.isAdmin).toBe(true);
  });

  it('provides user data and sets isAdmin to false when authenticated as member', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          user: { userId: 'member-1', role: 'member', displayName: 'Member User' },
        }),
    } as unknown as Response);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UserProvider>{children}</UserProvider>
    );

    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user?.userId).toBe('member-1');
    expect(result.current.isAdmin).toBe(false);
  });

  it('sets user to null when unauthorized', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
    } as unknown as Response);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UserProvider>{children}</UserProvider>
    );

    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.isAdmin).toBe(false);
  });
});
