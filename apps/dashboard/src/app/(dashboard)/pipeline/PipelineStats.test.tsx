// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PipelineStats from './PipelineStats';
import { GapStatus } from '@claw/core/lib/types';
import React from 'react';

// Mock translations
vi.mock('@/components/Providers/TranslationsProvider', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

describe('PipelineStats', () => {
  const mockGaps = [
    { userId: '1', status: GapStatus.OPEN, timestamp: Date.now(), content: 'test' },
    { userId: '2', status: GapStatus.PLANNED, timestamp: Date.now(), content: 'test' },
    { userId: '3', status: GapStatus.DONE, timestamp: Date.now(), content: 'test' },
  ];

  it('renders active and success counts correctly', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<PipelineStats gaps={mockGaps as any} />);

    // Active gaps (OPEN + PLANNED) = 2
    expect(screen.getByText('2')).toBeDefined();
    // Success gaps (DONE) = 1
    expect(screen.getByText('1')).toBeDefined();

    expect(screen.getByText('PIPELINE_ACTIVE')).toBeDefined();
    expect(screen.getByText('PIPELINE_SUCCESS')).toBeDefined();
  });
});
