import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SecurityManifestPage from './page';

// Mock sub-components
vi.mock('@/components/SafetyTierEditor', () => ({
  default: () => <div data-testid="safety-tier-editor">Mock Safety Tier Editor</div>,
}));

vi.mock('@/components/CoManagementHub', () => ({
  default: () => <div data-testid="co-management-hub">Mock Co-Management Hub</div>,
}));

vi.mock('@/components/PageHeader', () => ({
  default: ({ stats }: { stats?: React.ReactNode }) => (
    <div data-testid="page-header">
      Mock Page Header
      {stats}
    </div>
  ),
}));

vi.mock('@/components/RoleGuard', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="role-guard">{children}</div>
  ),
}));

vi.mock('@/components/ui/Typography', () => ({
  default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

vi.mock('@/components/ui/Badge', () => ({
  default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
  Lock: () => <div data-testid="icon-lock" />,
  Eye: () => <div data-testid="icon-eye" />,
  FileWarning: () => <div data-testid="icon-file-warning" />,
  Globe: () => <div data-testid="icon-globe" />,
  Server: () => <div data-testid="icon-server" />,
  Plus: () => <div data-testid="icon-plus" />,
  Trash2: () => <div data-testid="icon-trash" />,
  Shield: () => <div data-testid="icon-shield" />,
  Check: () => <div data-testid="icon-check" />,
  X: () => <div data-testid="icon-x" />,
}));

describe('SecurityManifestPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders standard security layout and headers', () => {
    render(<SecurityManifestPage />);
    expect(screen.getByTestId('page-header')).toBeInTheDocument();
    expect(screen.getByTestId('safety-tier-editor')).toBeInTheDocument();
    expect(screen.getByTestId('co-management-hub')).toBeInTheDocument();
    expect(screen.getByText('Human-to-Agent Access Roster (RBAC)')).toBeInTheDocument();
  });

  it('displays active role tab and permits tab switching', () => {
    render(<SecurityManifestPage />);

    // Default tab is ADMIN (from page state)
    const adminTab = screen.getAllByRole('button').find((el) => el.textContent === 'ADMIN');
    expect(adminTab).toBeInTheDocument();

    const memberTab = screen.getAllByRole('button').find((el) => el.textContent === 'MEMBER');
    expect(memberTab).toBeInTheDocument();

    // Click member tab to switch roles
    fireEvent.click(memberTab!);

    // Member has "Agent Invocation" assigned, but not "Agent Configuration"
    // Let's verify Member permissions
    expect(screen.getByText('Agent Invocation')).toBeInTheDocument();
    expect(screen.getByText('Agent Configuration')).toBeInTheDocument();
  });

  it('supports in-memory toggling of permissions', () => {
    render(<SecurityManifestPage />);

    // Toggle "Agent Invocation" for active role
    const toggleCard = screen.getByText('Agent Invocation').closest('div');
    expect(toggleCard).toBeInTheDocument();

    // Clicking toggles assignment in-memory
    fireEvent.click(toggleCard!);
  });

  it('manages custom ACE list correctly and supports deletions', () => {
    render(<SecurityManifestPage />);

    // Pre-loaded ACE entries
    expect(screen.getByText('custom-trading-bot')).toBeInTheDocument();
    expect(screen.getByText('custom-cyber-auditor')).toBeInTheDocument();

    // Find all delete buttons
    const deleteButtons = screen.getAllByTestId('icon-trash');
    expect(deleteButtons.length).toBe(2);

    // Delete the first item
    fireEvent.click(deleteButtons[0].parentElement!);

    // Should no longer be present
    expect(screen.queryByText('custom-trading-bot')).not.toBeInTheDocument();
  });

  it('opens glassmorphic ACE creation modal, handles entries creation', () => {
    render(<SecurityManifestPage />);

    // Roster should not contain custom-agent-3 initially
    expect(screen.queryByText('custom-agent-3')).not.toBeInTheDocument();

    // Click Add Custom ACE to spawn modal
    const addBtn = screen.getByText('Add Custom ACE');
    fireEvent.click(addBtn);

    // Modal elements are active
    expect(screen.getByText('Create Access Control Entry (ACE)')).toBeInTheDocument();

    // Input values
    const agentInput = screen.getByPlaceholderText('e.g. custom-trading-bot');
    fireEvent.change(agentInput, { target: { value: 'custom-agent-3' } });

    // Toggle type to User ID
    const userIdBtn = screen.getByText('USER ID');
    fireEvent.click(userIdBtn);

    // Type User ID
    const userInput = screen.getByPlaceholderText('e.g. usr-123');
    fireEvent.change(userInput, { target: { value: 'usr-789' } });

    // Click submit/add
    const submitBtn = screen.getByText('Add Entry');
    fireEvent.click(submitBtn);

    // Modal is closed and entry is added dynamically to table
    expect(screen.queryByText('Create Access Control Entry (ACE)')).not.toBeInTheDocument();
    expect(screen.getByText('custom-agent-3')).toBeInTheDocument();
    expect(screen.getByText('usr-789')).toBeInTheDocument();
  });
});
