import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Fill in the password (uses env var or fallback for local dev)
  const password = process.env.DASHBOARD_PASSWORD || 'test-password';
  console.log(
    `[E2E:Auth] Authenticating with password from ${process.env.DASHBOARD_PASSWORD ? 'env' : 'fallback'}`
  );

  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL('**/', { timeout: 90000 }),
    page.click('button[type="submit"]'),
  ]);

  // Ensure sidebar is visible
  await expect(page.locator('nav').first()).toBeVisible({ timeout: 30000 });

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
