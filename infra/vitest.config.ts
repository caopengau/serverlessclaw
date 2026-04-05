import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for the infra package.
 * Infrastructure-as-code (SST/Pulumi) has lower test coverage requirements
 * since it's validated through deployment verification and E2E tests.
 */
export default defineConfig({
  test: {
    globals: true,
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.sst/**'],
    coverage: {
      provider: 'v8',
      include: ['**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/node_modules/**', '**/.sst/**'],
      thresholds: {
        lines: 40,
        functions: 50,
        branches: 30,
        statements: 40,
      },
    },
  },
});
