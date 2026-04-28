// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AgentTuningHub from './AgentTuningHub';
import { TranslationsProvider } from '../Providers/TranslationsProvider';

// Mock UI components that are too heavy for unit tests
vi.mock('../DynamicComponents/StatusFlow', () => ({
  StatusFlow: () => <div data-testid="status-flow" />,
}));

vi.mock('../Chat/ChatHistoryTimeline', () => ({
  ChatHistoryTimeline: () => <div data-testid="history-timeline" />,
}));

// Mock API calls
const mockAgents = [
  {
    id: 'agent-1',
    name: 'Research Agent',
    enabled: true,
    evolutionMode: 'AUTONOMOUS',
    trustScore: 85,
    systemPrompt: 'Test prompt',
  },
];

vi.mock('../../lib/api/agents', () => ({
  fetchAgents: vi.fn(async () => mockAgents),
  updateAgent: vi.fn(async () => ({ success: true })),
}));

// Mock Framer Motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
    span: ({ children, ...props }: { children: React.ReactNode }) => (
      <span {...props}>{children}</span>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock Realtime Context
const mockRealtimeContext = {
  isConnected: true,
  error: null,
  userId: 'dashboard-user',
  subscribe: vi.fn(() => vi.fn()),
  sessions: [],
  pendingMessages: [],
  setPendingMessages: vi.fn(),
  fetchSessions: vi.fn(),
  isLive: true,
};

vi.mock('../Providers/RealtimeProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../Providers/RealtimeProvider')>();
  return {
    ...actual,
    useRealtimeContext: () => mockRealtimeContext,
    RealtimeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe('AgentTuningHub', () => {
  const defaultProps = {
    agentId: 'agent-1',
    lastTraceId: 'trace-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with agents', async () => {
    render(
      <TranslationsProvider>
        <AgentTuningHub {...defaultProps} />
      </TranslationsProvider>
    );

    expect(await screen.findByText('Evolution sandbox')).toBeInTheDocument();
  });

  it('handles window.location correctly', async () => {
    // Mock window.location
    const originalLocation = window.location;
    const mockLocation = new URL('http://localhost/chat');
    delete (window as unknown as { location: unknown }).location;
    (window as unknown as { location: unknown }).location = {
      ...originalLocation,
      href: mockLocation.href,
      pathname: mockLocation.pathname,
      search: mockLocation.search,
      hash: mockLocation.hash,
    };

    render(
      <TranslationsProvider>
        <AgentTuningHub {...defaultProps} />
      </TranslationsProvider>
    );

    expect(await screen.findByText('Evolution sandbox')).toBeInTheDocument();

    // Cleanup
    (window as unknown as { location: unknown }).location = originalLocation;
  });
});
