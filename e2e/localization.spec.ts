import path from 'path';
import { test, expect } from 'playwright/test';

test.describe('Localization', () => {
  test.use({ storageState: path.join(__dirname, '.auth/user.json') });

  test('should switch between English and Chinese', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify sidebar is visible
    await expect(page.locator('aside')).toBeVisible();

    // Detect toggle state and perform click to switch language
    const langBtnCN = page.getByRole('button', { name: 'CN', exact: true });
    const langBtnEN = page.getByRole('button', { name: 'EN', exact: true });

    if (await langBtnEN.count()) {
      // Currently in CN, click to switch to EN
      await langBtnEN.click();
      await expect(langBtnCN).toBeVisible({ timeout: 5000 });
    } else if (await langBtnCN.count()) {
      // Currently in EN, click to switch to CN
      await langBtnCN.click();
      await expect(langBtnEN).toBeVisible({ timeout: 5000 });
    }
  });
});
