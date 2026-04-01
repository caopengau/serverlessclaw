import { test, expect } from '@playwright/test';

test.describe('Localization', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('should switch between English and Chinese', async ({ page }) => {
    // 1. Go to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // 2. Select Chinese
    // Find the select for activeLocale - we can use the label "Language" or just the select name
    const languageSelect = page.locator('select[name="activeLocale"]');
    await languageSelect.selectOption('cn');

    // 3. Save
    const saveButton = page.locator('button:has-text("Save"), button:has-text("保存")');
    await saveButton.click();

    // 4. Verify sidebar changed (e.g. Operations -> 运维监控)
    const operationsHeader = page.locator('text=运维监控');
    await expect(operationsHeader).toBeVisible({ timeout: 10000 });

    // 5. Switch back to English
    await languageSelect.selectOption('en');
    await saveButton.click();

    // 6. Verify sidebar changed back
    const operationsHeaderEn = page.locator('text=Operations');
    await expect(operationsHeaderEn).toBeVisible({ timeout: 10000 });
  });
});
