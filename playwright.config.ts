import { defineConfig } from '@playwright/test';
import config from './framework/playwright.config';

/**
 * VoltX Root Playwright Configuration
 * Inherits generic E2E logic from the framework but enforces product-level isolation.
 */
export default defineConfig({
  ...config,
  // Override testDir to root since we are running from the root
  testDir: './',
  // Ensure we only run E2E specs and ignore unit test files in packages
  testIgnore: [
    '**/node_modules/**',
    '**/packages/**',
    '**/*.test.ts', // Ignore Vitest files
    '**/prompts/**',
  ],
  testMatch: ['framework/e2e/**/*.spec.ts', 'apps/*/tests/**/*.spec.ts'],
});
