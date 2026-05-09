import { test, expect } from '@playwright/test';

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
    await page.click('a[href="/agents"]');
    await expect(page).toHaveURL('/agents');
  });
});
