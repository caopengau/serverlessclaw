import path from 'path';
import { test, expect } from 'playwright/test';

test.describe('Capabilities / Tools & Skills', () => {
  test.use({ storageState: path.join(__dirname, '.auth/user.json') });

  test('renders capabilities page', async ({ page }) => {
    await page.goto('/capabilities');
    await expect(page).toHaveURL('/capabilities');
  });

  test('displays tab navigation', async ({ page }) => {
    await page.goto('/capabilities');
    await page.waitForLoadState('networkidle');
    // Should have tabs for different views
    const tabs = page.locator(
      '[role="tab"], button:has-text("Agents"), button:has-text("Library"), button:has-text("MCP")'
    );
    await expect(tabs.first()).toBeVisible({ timeout: 10000 });
  });

  test('can switch between tabs', async ({ page }) => {
    await page.goto('/capabilities');
    await page.waitForLoadState('networkidle');

    // Click on Library tab if it exists
    const libraryTab = page.locator('button:has-text("Library"), [role="tab"]:has-text("Library")');
    if (await libraryTab.isVisible()) {
      await libraryTab.click();
      // Content should change; wait for library header or content
      await expect(page.locator('text=/Library/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('navigation from sidebar to capabilities works', async ({ page }) => {
    await page.goto('/');
    // Wait for sidebar to be loaded and interactive
    await page.waitForLoadState('networkidle');
    // Add a small delay to ensure sidebar is rendered
    await page.waitForTimeout(500);

    // Try to find the capabilities link with better error context
    const capabilitiesLink = page.locator('a[href="/capabilities"]');

    // Check if link exists and is visible
    if (!(await capabilitiesLink.count())) {
      // Log page content for debugging
      const body = await page.locator('body').innerHTML();
      console.error(`[E2E] Capabilities link not found. Page contains: ${body.substring(0, 500)}`);
      throw new Error('Capabilities link (a[href="/capabilities"]) not found on home page');
    }

    // Wait for link to be visible and clickable
    await capabilitiesLink.waitFor({ state: 'visible', timeout: 5000 });
    await capabilitiesLink.click({ timeout: 5000 });

    // Verify navigation succeeded
    await expect(page).toHaveURL('/capabilities');
  });
});
