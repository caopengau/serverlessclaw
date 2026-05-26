import path from 'path';
import { test, expect } from 'playwright/test';

test.describe('VoltX VPP Dashboards E2E', () => {
  test.use({ storageState: path.join(__dirname, '.auth/user.json') });

  test.beforeEach(({ page }) => {
    page.on('console', (msg) => console.log(`[BROWSER CONSOLE: ${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) =>
      console.error(`[BROWSER UNHANDLED ERROR] ${err.stack || err.message}`)
    );
  });

  test('should load Mission Control, trigger DR simulator, and manage VPP sites', async ({
    page,
  }) => {
    // === 1. Load Mission Control & Verify Localization Switch ===
    await page.goto('/extension/voltx-mission-control');
    await page.waitForLoadState('networkidle');

    // Switch to English to guarantee E2E text matching
    const langBtnEN = page.getByRole('button', { name: 'EN', exact: true });
    if (await langBtnEN.count()) {
      await langBtnEN.click();
      // Wait for language toggle text to flip to 'CN' indicating active English locale
      await expect(page.getByRole('button', { name: 'CN', exact: true })).toBeVisible({
        timeout: 5000,
      });
    }

    // Verify branding header exists
    await expect(page.getByRole('heading', { name: /Enerlink/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/VPP Dispatch:/i)).toBeVisible();

    // Verify VPP Asset Portfolio elements are loaded in English
    await expect(page.getByText(/VPP Asset Portfolio/i)).toBeVisible();
    await expect(page.getByText(/Total Capacity/i)).toBeVisible();
    await expect(page.getByText(/Solar PV/i)).toBeVisible();

    await expect(page.getByText(/Real-time Optimization/i)).toBeVisible();
    await expect(page.getByText(/RL Model Version/i)).toBeVisible();
    await expect(page.getByText(/v3.2-PROD/i)).toBeVisible();

    // Let Next.js HMR settle completely before interacting with stateful simulator
    await page.waitForTimeout(5000);

    // === 2. Execute Demand Response Simulator Lifecycle ===
    const triggerBtn = page.getByRole('button', { name: /Trigger Grid Event|Trigger Event/i });
    await expect(triggerBtn).toBeVisible();
    await expect(page.getByText(/WAITING FOR SIGNAL/i)).toBeVisible();

    // Trigger grid event
    await triggerBtn.click();

    // In case of a rare HMR refresh immediately after navigation resetting state,
    // we check if we went back to WAITING FOR SIGNAL, and if so, click again.
    await page.waitForTimeout(1000);
    if (await page.getByText(/WAITING FOR SIGNAL/i).isVisible()) {
      console.log('Detected state reset via Fast Refresh, re-triggering event...');
      await triggerBtn.click();
    }

    // Check for analysis transition
    await expect(page.getByText(/SIGNAL DETECTED|ANALYZING/i)).toBeVisible({ timeout: 5000 });

    // Check for active execution (within 5 seconds)
    await expect(page.getByText(/EXECUTING BATT_DISCHARGE|DISCHARGE/i)).toBeVisible({
      timeout: 8000,
    });

    // Verify completion state (within 10 seconds)
    await expect(page.getByText(/EVENT COMPLETED|OPTIMIZED/i)).toBeVisible({ timeout: 12000 });

    // === 3. Navigate to Site Management & Onboard VPP Site ===
    await page.goto('/extension/voltx-asset-management');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/VPP Site Management/i)).toBeVisible({ timeout: 20000 });
    const registerBtn = page.getByRole('button', { name: /Register Site/i });
    await expect(registerBtn).toBeVisible();

    // Click to open Registration Modal
    await registerBtn.click();

    // Verify Modal elements
    await expect(page.getByRole('heading', { name: /Register New Site/i })).toBeVisible();
    const siteInput = page.getByPlaceholder(/e.g. Industrial Park A/i);
    await expect(siteInput).toBeVisible();

    // Fill site name and confirm
    const testSiteName = 'Shanghai VPP Mega-Hub';
    await siteInput.fill(testSiteName);
    await page.getByRole('button', { name: /CONFIRM/i }).click();

    // Verify site has been added to the list
    await expect(page.getByText(testSiteName)).toBeVisible({ timeout: 10000 });

    // Locate the specific site card container class='group' which houses the text span to delete
    const siteRow = page
      .locator('div.group', { has: page.locator('span', { hasText: testSiteName }) })
      .first();
    const deleteBtn = siteRow.locator('button');

    // Hover and delete
    await siteRow.hover();
    await deleteBtn.click();

    // Verify successful removal
    await expect(page.getByText(testSiteName)).not.toBeVisible({ timeout: 5000 });
  });
});
