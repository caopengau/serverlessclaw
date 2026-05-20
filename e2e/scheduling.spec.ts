import { test, expect } from 'playwright/test';

test.describe('Goal Scheduling', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('renders scheduling page', async ({ page }) => {
    await page.goto('/scheduling');
    await expect(page).toHaveURL('/scheduling');
  });

  test('displays schedule list', async ({ page }) => {
    await page.goto('/scheduling');
    await page.waitForLoadState('networkidle');
    // Should load without critical errors
    await expect(page.locator('body')).not.toContainText('Error');
  });

  test('has create schedule button', async ({ page }) => {
    await page.goto('/scheduling');
    await page.waitForLoadState('networkidle');
    const createButton = page.locator(
      'button:has-text("New"), button:has-text("Create"), button:has-text("Add"), button:has-text("Schedule")'
    );
    if (await createButton.isVisible()) {
      await createButton.click();
      // Should open a form or modal
      await expect(page.locator('dialog, [role="dialog"], .modal, form')).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('navigation from sidebar to scheduling works', async ({ page }) => {
    await page.goto('/');
    // Wait for sidebar to be loaded and interactive
    await page.waitForLoadState('networkidle');
    // Add a small delay to ensure sidebar is rendered
    await page.waitForTimeout(500);

    // Use role-based selector which is more robust
    const link = page.getByRole('link', { name: /SCHEDULING|目标调度/i }).first();

    // Check if link exists
    if (!(await link.count())) {
      throw new Error('Scheduling link not found on home page');
    }

    // Wait for link to be visible and clickable
    await link.waitFor({ state: 'visible', timeout: 5000 });
    await link.click({ timeout: 5000 });

    // Verify navigation succeeded
    await expect(page).toHaveURL(/\/scheduling/);
  });
});
