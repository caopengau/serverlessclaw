const isDeployed = !!process.env.BASE_URL && !process.env.BASE_URL.includes('localhost');

// Timeouts: deployed envs need more headroom due to cold-starts and network latency
const actionTimeout = isDeployed ? 15_000 : 5_000;
const expectTimeout = isDeployed ? 10_000 : 5_000;
const testTimeout = isDeployed ? 60_000 : 30_000;

export default {
  testDir: './e2e',
  timeout: testTimeout,
  expect: {
    timeout: expectTimeout,
  },
  retries: isDeployed ? 1 : 0, // Allow 1 retry on deployed to handle flakiness
  workers: process.env.CI ? 4 : undefined,
  use: {
    actionTimeout,
    baseURL: process.env.BASE_URL || 'http://localhost:7777',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Disable strict mode for better Playwright compatibility
    strictSelectors: false,
    // Trust HTTPS certs on deployed environments (self-signed not typically an issue with ACM,
    // but this avoids cert chain issues during E2E)
    ignoreHTTPSErrors: isDeployed,
  },
  webServer: process.env.BASE_URL
    ? undefined // skip local server when testing a deployed URL
    : {
        command: 'pnpm --filter @serverlessclaw/dashboard dev',
        port: 7777,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
      },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      // Auth setup needs extra time on deployed (cold-start + DynamoDB lookup)
      timeout: isDeployed ? 180_000 : 120_000,
      use: {
        baseURL: process.env.BASE_URL || 'http://localhost:7777',
        ignoreHTTPSErrors: isDeployed,
      },
    },
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
};
