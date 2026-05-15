import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TuningGroundPage from './page';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Lucide icons used in the page
vi.mock('lucide-react', () => ({
  Database: () => <div data-testid="icon-database" />,
  Download: () => <div data-testid="icon-download" />,
  Play: () => <div data-testid="icon-play" />,
  Save: () => <div data-testid="icon-save" />,
  CheckCircle: () => <div data-testid="icon-check-circle" />,
  XCircle: () => <div data-testid="icon-x-circle" />,
}));

describe('Tuning Ground Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially and then displays traces', async () => {
    render(<TuningGroundPage />);

    expect(screen.getByText('Loading traces from Data Lake...')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.queryByText('Loading traces from Data Lake...')).not.toBeInTheDocument();
      },
      { timeout: 1500 }
    );

    expect(screen.getByText('trace-1')).toBeInTheDocument();
    expect(screen.getByText('coderAgent')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('handles approving a trace', async () => {
    render(<TuningGroundPage />);

    await waitFor(
      () => {
        expect(screen.getByText('trace-1')).toBeInTheDocument();
      },
      { timeout: 1500 }
    );

    // Find the approve button for trace-1 (it's the first trace)
    const approveButtons = screen.getAllByTestId('icon-check-circle');
    // First trace is PENDING, so we can approve it
    fireEvent.click(approveButtons[0].parentElement!);

    expect(toast.success).toHaveBeenCalledWith('Trace trace-1 marked as APPROVED.');
  });

  it('handles triggering fine-tuning with insufficient traces', async () => {
    render(<TuningGroundPage />);

    await waitFor(
      () => {
        expect(screen.getByText('trace-1')).toBeInTheDocument();
      },
      { timeout: 1500 }
    );

    const triggerButton = screen.getByText('Trigger Fine-Tuning');
    fireEvent.click(triggerButton);

    expect(toast.error).toHaveBeenCalledWith(
      'Insufficient approved traces. Require at least 10 to trigger fine-tuning.'
    );
  });

  it('renders the provider selection dropdown', async () => {
    render(<TuningGroundPage />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('DeepSeek v4 Flash');
  });

  it('allows changing the provider selection', async () => {
    render(<TuningGroundPage />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'MiniMax 2.7' } });

    expect(select).toHaveValue('MiniMax 2.7');
  });
});
