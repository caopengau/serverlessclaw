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
  },
});
