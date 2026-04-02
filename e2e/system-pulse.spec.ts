import { test, expect } from '@playwright/test';

test.describe('System Pulse', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('renders system pulse page', async ({ page }) => {
    await page.goto('/system-pulse');
    await expect(page).toHaveURL('/system-pulse');
  });

  test('displays React Flow graph container', async ({ page }) => {
    await page.goto('/system-pulse');
    await page.waitForLoadState('networkidle');
    // React Flow renders a container with specific classes
    const flowContainer = page.locator('.react-flow').first();
    await expect(flowContainer).toBeVisible({ timeout: 15000 });
  });

  test('loads topology data without errors', async ({ page }) => {
    await page.goto('/system-pulse');
    await page.waitForLoadState('networkidle');
    // Should not show critical error states
    await expect(page.locator('body')).not.toContainText('Failed to fetch');
  });

  test('navigation from sidebar to system pulse works', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/system-pulse"]');
    await expect(page).toHaveURL('/system-pulse');
  });
});
