// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CyberTooltip from './CyberTooltip';

describe('CyberTooltip Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders children correctly', () => {
    render(
      <CyberTooltip content="Tooltip Content">
        <button>Hover Me</button>
      </CyberTooltip>
    );
    
    expect(screen.getByText('Hover Me')).toBeInTheDocument();
  });

  it('shows tooltip content on mouse enter', async () => {
    render(
      <CyberTooltip content="Tooltip Content">
        <button>Hover Me</button>
      </CyberTooltip>
    );

    const trigger = screen.getByText('Hover Me');
    fireEvent.mouseEnter(trigger);

    // Since it uses Portals, we look for it in the document body
    expect(screen.getByText('Tooltip Content')).toBeInTheDocument();
  });

  it('hides tooltip content on mouse leave', async () => {
    render(
      <CyberTooltip content="Tooltip Content">
        <button>Hover Me</button>
      </CyberTooltip>
    );

    const trigger = screen.getByText('Hover Me');
    fireEvent.mouseEnter(trigger);
    expect(screen.getByText('Tooltip Content')).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByText('Tooltip Content')).not.toBeInTheDocument();
  });

  it('renders info icon when no children are provided and showIcon is true', () => {
    const { container } = render(<CyberTooltip content="Tooltip Content" showIcon={true} />);
    
    // Lucide-react Info icon should be present
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('does not render info icon when showIcon is false', () => {
    const { container } = render(<CyberTooltip content="Tooltip Content" showIcon={false} />);
    
    const svg = container.querySelector('svg');
    expect(svg).not.toBeInTheDocument();
  });
});
