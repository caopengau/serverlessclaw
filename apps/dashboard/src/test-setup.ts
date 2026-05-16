import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
};
global.localStorage = localStorageMock as unknown as Storage;

// Global mock for next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => ({
    get: vi.fn(),
  })),
}));

// Simple mock for ExtensionProvider
vi.mock('@/components/Providers/ExtensionProvider', () => ({
  useExtensions: () => ({
    sidebarExtensions: [],
    dynamicComponents: new Map(),
    layoutExtensions: new Map(),
    registerSidebarExtension: vi.fn(),
    registerDynamicComponent: vi.fn(),
    registerLayoutExtension: vi.fn(),
  }),
}));

// Mock NotificationBell to prevent tests from failing due to internal fetching
vi.mock('@/components/NotificationBell', () => ({
  __esModule: true,
  default: () => null,
}));
