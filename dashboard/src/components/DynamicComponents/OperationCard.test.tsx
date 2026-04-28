// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import OperationCard from './OperationCard';

describe('OperationCard', () => {
  const defaultProps = {
    component: {
      id: '1',
      componentType: 'operation-card',
      props: {
        title: 'Security Scan',
        status: 'active',
        description: 'Vulnerability assessment in progress.',
        details: {
          scanned_files: 150,
          threats_found: 0,
        },
      },
      actions: [
        { id: 'stop', label: 'Stop Scan', type: 'danger' },
        { id: 'view-report', label: 'View Report', type: 'primary' },
      ],
    },
    onAction: vi.fn(),
  };

  it('renders correctly with all props', () => {
    render(<OperationCard {...(defaultProps as any)} />);
    expect(screen.getByText('Security Scan')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('Vulnerability assessment in progress.')).toBeInTheDocument();
    expect(screen.getByText(/scanned files/i)).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('calls onAction when buttons are clicked', () => {
    render(<OperationCard {...(defaultProps as any)} />);

    fireEvent.click(screen.getByText('Stop Scan'));
    expect(defaultProps.onAction).toHaveBeenCalledWith('stop', undefined);

    fireEvent.click(screen.getByText('View Report'));
    expect(defaultProps.onAction).toHaveBeenCalledWith('view-report', undefined);
  });

  it('renders without status or details', () => {
    const minimalProps = {
      component: {
        id: '2',
        componentType: 'operation-card',
        props: {
          title: 'Simple Task',
        },
      },
    };
    render(<OperationCard {...(minimalProps as any)} />);
    expect(screen.getByText('Simple Task')).toBeInTheDocument();
    expect(screen.queryByText('active')).not.toBeInTheDocument();
  });
});
