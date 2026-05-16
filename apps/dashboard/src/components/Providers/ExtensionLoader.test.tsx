import { render, waitFor } from '@testing-library/react';
import { ExtensionLoader } from './ExtensionLoader';
import { useExtensions } from './ExtensionProvider';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the useExtensions hook
vi.mock('./ExtensionProvider', () => ({
  useExtensions: vi.fn(),
}));

// Mock the dynamic import
vi.mock('../../extensions', () => ({
  init: vi.fn(),
}));

describe('ExtensionLoader', () => {
  const mockRegisterSidebar = vi.fn();
  const mockRegisterComponent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useExtensions as unknown as { mockReturnValue: (v: any) => void }).mockReturnValue({
      registerSidebarExtension: mockRegisterSidebar,
      registerDynamicComponent: mockRegisterComponent,
    });
  });

  it('should attempt to load extensions on mount', async () => {
    const { init } = await import('../../extensions');

    render(<ExtensionLoader />);

    await waitFor(() => {
      expect(init).toHaveBeenCalledWith({
        registerSidebar: mockRegisterSidebar,
        registerComponent: mockRegisterComponent,
      });
    });
  });

  it('should only load extensions once even if re-rendered', async () => {
    const { init } = await import('../../extensions');

    const { rerender } = render(<ExtensionLoader />);
    rerender(<ExtensionLoader />);

    await waitFor(() => {
      expect(init).toHaveBeenCalledTimes(1);
    });
  });

  it('should fail silently if no extensions are found', async () => {
    const { init } = await import('../../extensions');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (init as unknown as { mockImplementationOnce: (v: any) => void }).mockImplementationOnce(() => {
      throw new Error('Not found');
    });

    // Should not throw
    render(<ExtensionLoader />);
  });
});
