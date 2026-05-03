import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('renders settings page', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');
  });

  test('displays settings form', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    // Should have form elements
    const form = page.locator('form, [class*="settings"], select, input[type="number"]');
    await expect(form.first()).toBeVisible({ timeout: 10000 });
  });

  test('settings page loads without errors', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Failed to');
  });

  test('navigation from sidebar to settings works', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/settings"]');
    await expect(page).toHaveURL('/settings');
  });
});
