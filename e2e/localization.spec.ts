import { test, expect } from '@playwright/test';

test.describe('Localization', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('should switch between English and Chinese', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // 1. Identify current language
    const langButton = page.getByRole('button', { name: /English|Chinese|中文|英语/i }).first();
    const currentText = (await langButton.textContent()) || '';
    const isCurrentlyEnglish = currentText.includes('English') || currentText.includes('英语');

    const targetLangLabel = isCurrentlyEnglish ? /Chinese|中文/i : /English|英语/i;
    const returnLangLabel = isCurrentlyEnglish ? /English|英语/i : /Chinese|中文/i;

    // 2. Switch language
    await langButton.click();
    const targetOption = page.getByRole('button', { name: targetLangLabel }).last();
    await targetOption.click();

    // 3. Save if enabled (it should be enabled now as we changed the state)
    const saveButton = page.locator('button[type="submit"][form="settings-form"]');
    await expect(saveButton).toBeEnabled({ timeout: 10000 });
    await saveButton.click();

    // 4. Verify sidebar changed
    const expectedSidebarText = isCurrentlyEnglish ? /运维监控/i : /Operations/i;
    await expect(page.locator('aside').first()).toContainText(expectedSidebarText, {
      timeout: 15000,
    });

    // 5. Switch back
    const langButtonAfter = page
      .getByRole('button', { name: /English|Chinese|中文|英语/i })
      .first();
    await langButtonAfter.click();
    const returnOption = page.getByRole('button', { name: returnLangLabel }).last();
    await returnOption.click();

    await expect(saveButton).toBeEnabled({ timeout: 10000 });
    await saveButton.click();

    // 6. Verify sidebar back to original
    const returnSidebarText = isCurrentlyEnglish ? /Operations/i : /运维监控/i;
    await expect(page.locator('aside').first()).toContainText(returnSidebarText, {
      timeout: 15000,
    });
  });
});
