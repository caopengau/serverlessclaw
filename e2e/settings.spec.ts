import path from 'path';
import { test, expect } from 'playwright/test';

test.describe('Settings', () => {
  test.use({ storageState: path.join(__dirname, '.auth/user.json') });

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
    // Wait for sidebar to be loaded and interactive
    await page.waitForLoadState('networkidle');
    // Add a small delay to ensure sidebar is rendered
    await page.waitForTimeout(500);

    // Try to find the settings link with better error context
    const settingsLink = page.locator('a[href="/settings"]');

    // Check if link exists and is visible
    if (!(await settingsLink.count())) {
      throw new Error('Settings link (a[href="/settings"]) not found on home page');
    }

    // Wait for link to be visible and clickable
    await settingsLink.waitFor({ state: 'visible', timeout: 5000 });
    await settingsLink.click({ timeout: 5000 });

    // Verify navigation succeeded
    await expect(page).toHaveURL('/settings');
  });
});
