// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ResourcePreview from './ResourcePreview';

describe('ResourcePreview', () => {
  const defaultProps = {
    component: {
      id: '1',
      componentType: 'resource-preview',
      props: {
        resourceType: 'lambda',
        resourceId: 'arn:aws:lambda:us-east-1:123456789:function:my-function',
        description: 'Process incoming telemetry data.',
        status: 'ACTIVE',
        metrics: {
          invocations: 500,
          errors: 0,
        },
      },
      actions: [
        { id: 'invoke', label: 'Invoke' },
      ],
    },
    onAction: vi.fn(),
  };

  it('renders lambda resource correctly', () => {
    render(<ResourcePreview {...defaultProps as any} />);
    expect(screen.getByText('LAMBDA')).toBeInTheDocument();
    expect(screen.getByText(/my-function/i)).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('invocations')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('renders other resource types (dynamodb, s3)', () => {
    const { rerender } = render(<ResourcePreview {...defaultProps as any} component={{ ...defaultProps.component, props: { ...defaultProps.component.props, resourceType: 'dynamodb' } } as any} />);
    expect(screen.getByText('DYNAMODB')).toBeInTheDocument();

    rerender(<ResourcePreview {...defaultProps as any} component={{ ...defaultProps.component, props: { ...defaultProps.component.props, resourceType: 's3' } } as any} />);
    expect(screen.getByText('S3')).toBeInTheDocument();
  });

  it('calls onAction when footer buttons are clicked', () => {
    render(<ResourcePreview {...defaultProps as any} />);
    fireEvent.click(screen.getByText('Invoke'));
    expect(defaultProps.onAction).toHaveBeenCalledWith('invoke', undefined);
  });

  it('shows default view console button if no actions', () => {
    const noActionsProps = {
      component: {
        ...defaultProps.component,
        actions: undefined,
      },
    };
    render(<ResourcePreview {...noActionsProps as any} />);
    expect(screen.getByText(/View Console/i)).toBeInTheDocument();
  });
});
