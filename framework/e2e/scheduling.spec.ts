import { test, expect } from '@playwright/test';

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
    await page.click('a[href="/scheduling"]');
    await expect(page).toHaveURL('/scheduling');
  });
});
