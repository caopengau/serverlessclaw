import { render, screen } from '@testing-library/react';
import RoleGuard from './RoleGuard';
import { UserProvider } from './Providers/UserProvider';
import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UserRole } from '@claw/core/lib/types/common';

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('RoleGuard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders children when user has required role', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          user: { userId: 'admin-1', role: UserRole.ADMIN },
        }),
    });

    render(
      <UserProvider>
        <RoleGuard requiredRoles={[UserRole.ADMIN]}>
          <div data-testid="protected-content">Protected Content</div>
        </RoleGuard>
      </UserProvider>
    );

    // Wait for loading to finish
    expect(await screen.findByTestId('protected-content')).toBeDefined();
    expect(screen.getByText('Protected Content')).toBeDefined();
  });

  it('renders access denied message when user does not have required role', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          user: { userId: 'member-1', role: UserRole.MEMBER },
        }),
    });

    render(
      <UserProvider>
        <RoleGuard requiredRoles={[UserRole.ADMIN]}>
          <div data-testid="protected-content">Protected Content</div>
        </RoleGuard>
      </UserProvider>
    );

    // Should show access denied
    expect(await screen.findByText('Access Denied')).toBeDefined();
    expect(screen.queryByTestId('protected-content')).toBeNull();
  });

  it('always allows OWNER even if not in requiredRoles', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          user: { userId: 'owner-1', role: UserRole.OWNER },
        }),
    });

    render(
      <UserProvider>
        <RoleGuard requiredRoles={[UserRole.ADMIN]}>
          <div data-testid="protected-content">Protected Content</div>
        </RoleGuard>
      </UserProvider>
    );

    expect(await screen.findByTestId('protected-content')).toBeDefined();
  });
});
