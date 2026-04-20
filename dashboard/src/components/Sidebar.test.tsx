// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Sidebar from './Sidebar';

// Define the mock before hoisting it
const { mockUseUICommand, mockUseRealtimeContext, mockUseTheme, mockUseTranslations } = vi.hoisted(() => ({
  mockUseUICommand: vi.fn().mockReturnValue({
    isSidebarCollapsed: false,
    setSidebarCollapsed: vi.fn(),
  }),
  mockUseRealtimeContext: vi.fn().mockReturnValue({
    isConnected: true,
  }),
  mockUseTheme: vi.fn().mockReturnValue({
    theme: 'dark',
    setTheme: vi.fn(),
  }),
  mockUseTranslations: vi.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

// Mock dependencies using the hoisted mocks
vi.mock('@/components/Providers/TranslationsProvider', () => ({
  useTranslations: mockUseTranslations,
}));

vi.mock('@/components/Providers/RealtimeProvider', () => ({
  useRealtimeContext: mockUseRealtimeContext,
}));

vi.mock('@/components/Providers/UICommandProvider', () => ({
  useUICommand: mockUseUICommand,
}));

vi.mock('next-themes', () => ({
  useTheme: mockUseTheme,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Activity: () => <div data-testid="icon-activity" />,
  MessageSquare: () => <div data-testid="icon-messages" />,
  Settings: () => <div data-testid="icon-settings" />,
  Lock: () => <div data-testid="icon-lock" />,
  Share2: () => <div data-testid="icon-share" />,
  Zap: () => <div data-testid="icon-zap" />,
  Menu: () => <div data-testid="icon-menu" />,
  X: () => <div data-testid="icon-x" />,
  ChevronRight: () => <div data-testid="icon-chevron-right" />,
  PanelLeftClose: () => <div data-testid="icon-panel-close" />,
  PanelLeftOpen: () => <div data-testid="icon-panel-open" />,
  Users: () => <div data-testid="icon-users" />,
  Brain: () => <div data-testid="icon-brain" />,
  Wrench: () => <div data-testid="icon-wrench" />,
  Server: () => <div data-testid="icon-server" />,
  Calendar: () => <div data-testid="icon-calendar" />,
  BrainCircuit: () => <div data-testid="icon-brain-circuit" />,
  Building2: () => <div data-testid="icon-building" />,
  Vote: () => <div data-testid="icon-vote" />,
  Sun: () => <div data-testid="icon-sun" />,
  Moon: () => <div data-testid="icon-moon" />,
  Monitor: () => <div data-testid="icon-monitor" />,
  LogOut: () => <div data-testid="icon-logout" />,
  Radio: () => <div data-testid="icon-radio" />,
}));

// Mock CyberTooltip
vi.mock('@/components/CyberTooltip', () => ({
  default: ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) => (
    <div data-testid="cyber-tooltip" data-content={typeof content === 'string' ? content : 'complex-content'}>
      {children}
    </div>
  ),
}));

describe('Sidebar Component', () => {
  it('renders in expanded mode by default', () => {
    mockUseUICommand.mockReturnValue({
      isSidebarCollapsed: false,
      setSidebarCollapsed: vi.fn(),
    });

    render(<Sidebar />);
    
    // Check for some labels that should be visible when expanded
    // Note: The labels are translated, so they'll be the keys because of our mock
    expect(screen.getByText('OPERATIONS')).toBeInTheDocument();
    expect(screen.getByText('AGENTS')).toBeInTheDocument();
    
    // Tooltips should NOT be present for main nav links when expanded
    expect(screen.queryByTestId('cyber-tooltip')).not.toBeInTheDocument();
  });

  it('renders in collapsed mode and shows tooltips', () => {
    mockUseUICommand.mockReturnValue({
      isSidebarCollapsed: true,
      setSidebarCollapsed: vi.fn(),
    });

    render(<Sidebar />);
    
    // Labels should NOT be visible directly (they are inside tooltips or hidden)
    // Wait, the labels might still be in the DOM but hidden. 
    // In our mock, CyberTooltip renders children, so the Link with labels might still be there.
    
    // Verification: CyberTooltip should be present for nav links when collapsed
    const tooltips = screen.getAllByTestId('cyber-tooltip');
    expect(tooltips.length).toBeGreaterThan(0);
  });
});
