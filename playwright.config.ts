import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:7777',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.BASE_URL
    ? undefined // skip local server when testing a deployed URL
    : {
        command: 'pnpm --filter dashboard dev',
        port: 7777,
        reuseExistingServer: !process.env.CI,
      },
});
