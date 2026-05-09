// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import StatsBar from './StatsBar';
import { EnrichedTrace, TranslationFn } from './types';

describe('StatsBar Component', () => {
  const mockTraces: EnrichedTrace[] = [
    {
      traceId: '1',
      timestamp: Date.now(),
      status: 'completed',
      source: 'dashboard',
      steps: [],
      toolsUsed: ['tool1', 'tool2'],
      model: 'gpt-4',
      totalTokens: 1000,
      sessionId: 'session1',
      agentId: 'agent1',
    } as unknown as EnrichedTrace,
    {
      traceId: '2',
      timestamp: Date.now(),
      status: 'error',
      source: 'telegram',
      steps: [],
      toolsUsed: ['tool1'],
      model: 'gpt-4',
      totalTokens: 500,
      sessionId: 'session2',
      agentId: 'agent2',
    } as unknown as EnrichedTrace,
  ];

  const mockT = vi.fn((key: string) => key) as unknown as TranslationFn;

  it('renders total operations correctly', () => {
    render(<StatsBar traces={mockTraces} t={mockT} />);
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('TOTAL_OPERATIONS')).toBeInTheDocument();
  });

  it('calculates active sessions correctly', () => {
    render(<StatsBar traces={mockTraces} t={mockT} />);
    // Set of session1 and session2 is 2
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('ACTIVE_SESSIONS')).toBeInTheDocument();
  });

  it('calculates tools invoked correctly', () => {
    render(<StatsBar traces={mockTraces} t={mockT} />);
    // Set of ['tool1', 'tool2'] and ['tool1'] is 2
    expect(screen.getAllByText('2').length).toBe(3);
    expect(screen.getByText('TOOLS_INVOKED')).toBeInTheDocument();
  });

  it('calculates token cost correctly', () => {
    render(<StatsBar traces={mockTraces} t={mockT} />);
    // 1000 + 500 = 1500 -> 1.5k
    expect(screen.getByText('1.5k')).toBeInTheDocument();
    expect(screen.getByText('TOKEN_COST')).toBeInTheDocument();
  });
});
