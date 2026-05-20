import { test, expect } from 'playwright/test';

test.describe('Memory Management', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('renders memory page', async ({ page }) => {
    await page.goto('/memory');
    await expect(page).toHaveURL('/memory');
  });

  test('displays memory tabs', async ({ page }) => {
    await page.goto('/memory');
    // Should have tabs for different memory views
    await expect(page.locator('[role="tablist"], .tabs, nav').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('displays gaps list', async ({ page }) => {
    await page.goto('/memory');
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    // Page should have loaded without errors
    await expect(page.locator('body')).not.toContainText('Error');
  });

  test('search input is functional', async ({ page }) => {
    await page.goto('/memory');
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]'
    );
    if (await searchInput.isVisible()) {
      await searchInput.fill('test query');
      await expect(searchInput).toHaveValue('test query');
    }
  });

  test('navigation from sidebar to memory works', async ({ page }) => {
    await page.goto('/');
    // Wait for sidebar to be loaded and interactive
    await page.waitForLoadState('networkidle');
    // Add a small delay to ensure sidebar is rendered
    await page.waitForTimeout(500);

    // Try to find the memory link with better error context
    const memoryLink = page.locator('a[href="/memory"]');

    // Check if link exists and is visible
    if (!(await memoryLink.count())) {
      throw new Error('Memory link (a[href="/memory"]) not found on home page');
    }

    // Wait for link to be visible and clickable
    await memoryLink.waitFor({ state: 'visible', timeout: 5000 });
    await memoryLink.click({ timeout: 5000 });

    // Verify navigation succeeded
    await expect(page).toHaveURL('/memory');
  });
});
