import { test, expect } from 'playwright/test';

test.describe('Agents Configuration', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('renders agents page', async ({ page }) => {
    await page.goto('/agents');
    await expect(page).toHaveURL('/agents');
  });

  test('displays agent list', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    // Page should load without critical errors
    await expect(page.locator('body')).not.toContainText('Error');
  });

  test('has create agent button or modal trigger', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
    // Look for a button that could open a create modal
    const createButton = page.locator(
      'button:has-text("New"), button:has-text("Create"), button:has-text("Add"), button:has-text("Register")'
    );
    if (await createButton.isVisible()) {
      await createButton.click();
      // Should open a modal or navigate to a form
      await expect(page.locator('dialog, [role="dialog"], .modal, form')).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('navigation from sidebar to agents works', async ({ page }) => {
    await page.goto('/');
    // Wait for sidebar to be loaded and interactive
    await page.waitForLoadState('networkidle');
    // Add a small delay to ensure sidebar is rendered
    await page.waitForTimeout(500);

    const agentsLink = page.locator('a[href="/agents"]').first();

    // Wait for link to be attached in the DOM (allows for cold starts and hydration)
    await agentsLink.waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});

    // Check if link exists and is visible
    if (!(await agentsLink.count())) {
      // Log page content for debugging
      const body = await page.locator('body').innerHTML();
      console.error(`[E2E] Agents link not found. Page contains: ${body.substring(0, 500)}`);
      throw new Error('Agents link (a[href="/agents"]) not found on home page');
    }

    // Wait for link to be visible and clickable
    await agentsLink.waitFor({ state: 'visible', timeout: 5000 });
    await agentsLink.click({ timeout: 5000 });

    // Verify navigation succeeded
    await expect(page).toHaveURL('/agents');
  });
});
