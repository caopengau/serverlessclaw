// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import TraceCard from './TraceCard';
import { EnrichedTrace } from './types';

// Mock DeleteTraceButton
vi.mock('@/components/DeleteTraceButton', () => ({
  default: () => <button>Delete</button>,
}));

describe('TraceCard Component', () => {
  const mockTrace: EnrichedTrace = {
    traceId: 'trace-123',
    timestamp: new Date('2024-05-05T12:00:00Z').getTime(),
    status: 'completed',
    source: 'dashboard',
    steps: [],
    toolsUsed: ['tool-a', 'tool-b'],
    model: 'gpt-4',
    totalTokens: 1200,
    sessionId: 'session-456',
    agentId: 'agent-789',
    initialContext: {
      userText: 'Test operation',
    },
  } as unknown as EnrichedTrace;

  it('renders trace status and source', () => {
    render(<TraceCard trace={mockTrace} />);
    expect(screen.getByText(/COMPLETED/i)).toBeInTheDocument();
    expect(screen.getByText(/DASHBOARD/i)).toBeInTheDocument();
  });

  it('renders user text from initial context', () => {
    render(<TraceCard trace={mockTrace} />);
    expect(screen.getByText('Test operation')).toBeInTheDocument();
  });

  it('renders system task when user text is missing', () => {
    const systemTrace = { ...mockTrace, initialContext: undefined };
    render(<TraceCard trace={systemTrace as unknown as EnrichedTrace} />);
    expect(screen.getByText('System Task')).toBeInTheDocument();
  });

  it('renders token count correctly', () => {
    render(<TraceCard trace={mockTrace} />);
    expect(screen.getByText('1200')).toBeInTheDocument();
  });

  it('renders tool tags', () => {
    render(<TraceCard trace={mockTrace} />);
    expect(screen.getByText(/TOOL-A/i)).toBeInTheDocument();
    expect(screen.getByText(/TOOL-B/i)).toBeInTheDocument();
  });

  it('renders timestamp in HH:mm:ss format', () => {
    render(<TraceCard trace={mockTrace} />);
    // 12:00:00Z
    expect(screen.getByText(/12:00:00/)).toBeInTheDocument();
  });
});
