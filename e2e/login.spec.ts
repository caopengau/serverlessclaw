import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders login page', async ({ page }) => {
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows error on invalid password', async ({ page }) => {
    await page.fill('input[type="password"]', 'wrong-password');
    await page.click('button[type="submit"]');

    // Should show error message and stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects to home on valid password', async ({ page }) => {
    const password = process.env.DASHBOARD_PASSWORD || 'test-password';
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });

  test('sets auth cookie on successful login', async ({ page, context }) => {
    const password = process.env.DASHBOARD_PASSWORD || 'test-password';
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    await page.waitForURL('/');
    const cookies = await context.cookies();
    const authCookie = cookies.find((c) => c.name === 'claw_auth_session');
    expect(authCookie).toBeDefined();
    expect(authCookie!.value).toBe('authenticated');
  });
});
