import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for the project, providing unified test execution
 * for both core logic and dashboard components with 2026-grade aliases.
 */
export default defineConfig({
  assetsInclude: ['**/*.md'],
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000,
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/.open-next/**'],
    alias: {
      '@': path.resolve(__dirname, './dashboard/src'),
      '@claw/core': path.resolve(__dirname, './core'),
    },
    coverage: {
      provider: 'v8',
      include: ['core/**/*.ts', 'infra/**/*.ts', 'dashboard/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/.sst/**',
        '**/.next/**',
        '**/.open-next/**',
      ],
      thresholds: {
        lines: 50,
        functions: 40,
        branches: 40,
        statements: 48,
      },
    },
  },
});
