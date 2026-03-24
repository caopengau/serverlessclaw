import { test as setup } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Fill in the password (uses env var or fallback for local dev)
  const password = process.env.DASHBOARD_PASSWORD || 'test-password';
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect to home page
  await page.waitForURL('/');

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
