import { test, expect } from 'playwright/test';

const isDeployed = !!process.env.BASE_URL && !process.env.BASE_URL.includes('localhost');
const E2E_PASSWORD = process.env.DASHBOARD_PASSWORD || (isDeployed ? 'claw123' : 'test-password');

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders login page', async ({ page }) => {
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows error on invalid password', async ({ page }) => {
    await page.fill('input[type="password"]', 'definitely-wrong-password-xyz-123');
    await page.click('button[type="submit"]');

    // Should show error message and stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects to home on valid password', async ({ page }) => {
    await page.fill('input[type="password"]', E2E_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });

  test('sets auth cookie on successful login', async ({ page, context }) => {
    await page.fill('input[type="password"]', E2E_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL('/');
    const cookies = await context.cookies();
    const authCookie = cookies.find((c) => c.name === 'claw_auth_session');
    expect(authCookie).toBeDefined();
    expect(authCookie!.value).toBe('authenticated');
  });
});
