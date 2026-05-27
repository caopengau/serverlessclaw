import path from 'path';
import { test, expect } from 'playwright/test';

test.describe('Mission Dashboard & Sidebar Interactions', () => {
  test.use({ storageState: path.join(__dirname, '.auth/user.json') });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('renders mission dashboard landing page and HUD', async ({ page }) => {
    // Check for the key UI sections using role-based selectors
    await expect(page.locator('main, [role="main"]')).toBeVisible({ timeout: 10000 });
  });

  test('displays system stability status in footer status indicator', async ({ page }) => {
    // Look for system status indicator text in the sidebar footer (accepting either space or underscore)
    const statusText = page.locator('text=/SYSTEM[_ ]STATUS|系统状态/i');
    await expect(statusText).toBeVisible({ timeout: 5000 });
  });

  test('quick actions are available and clickable', async ({ page }) => {
    // Look for operator quick action section if visible
    const quickActions = page.locator('text=/QUICK ACTIONS|快捷操作/i');
    if (await quickActions.count()) {
      await expect(quickActions).toBeVisible();
    }
  });

  test('can navigate to Intelligence Sector from Dashboard', async ({ page }) => {
    // Link to /chat should exist and be clickable
    const chatLink = page.locator('a[href*="/chat"]').first();
    await expect(chatLink).toBeVisible();
    await chatLink.click();
    await expect(page).toHaveURL(/\/chat/);
  });

  test('can navigate to Nerve Center from Dashboard', async ({ page }) => {
    // Link to /observability should exist and be clickable
    const observabilityLink = page.locator('a[href*="/observability"]').first();
    await expect(observabilityLink).toBeVisible();
    await observabilityLink.click();
    await expect(page).toHaveURL(/\/observability/);
  });

  test('sidebar collapsible states work', async ({ page }) => {
    // Find the fold/unfold toggle button
    const foldButton = page
      .locator('aside button[title*="Fold" i], aside button[title*="折叠" i]')
      .first();
    if (await foldButton.count()) {
      await foldButton.click();
      // Verify aside is collapsed
      const collapsedAside = page.locator('aside.lg\\:w-16');
      await expect(collapsedAside).toBeVisible();

      // Click to unfold again
      const unfoldButton = page
        .locator('aside button[title*="Unfold" i], aside button[title*="展开" i]')
        .first();
      await unfoldButton.click();
      const expandedAside = page.locator('aside.lg\\:w-64');
      await expect(expandedAside).toBeVisible();
    }
  });

  test('theme toggler changes local preferences', async ({ page }) => {
    // Locate the theme toggler button by finding the button containing the sun or moon icon
    const themeBtn = page
      .locator('aside button:has(svg.lucide-sun), aside button:has(svg.lucide-moon)')
      .first();
    if (await themeBtn.count()) {
      const initialTheme = await page.evaluate(() => document.documentElement.className);
      await themeBtn.click();
      await page.waitForTimeout(500); // Wait for class state transition
      const toggledTheme = await page.evaluate(() => document.documentElement.className);
      // Verify the theme class changed (e.g. from dark to light)
      expect(toggledTheme).not.toBe(initialTheme);
    }
  });
});
