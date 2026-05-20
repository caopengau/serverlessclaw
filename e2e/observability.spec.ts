import { test, expect } from 'playwright/test';

test.describe('Nerve Center (Unified Observability)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/observability');
    // Ensure the hub is loaded
    await expect(page.getByText(/Nerve Center Hub|神经中枢|Nerve Center/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('renders nerve center with tabbed interface', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /Infra Pulse|结构脉搏/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Resilience|韧性中心/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Cognitive|认知健康/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Traffic|并发流量/i })).toBeVisible();
  });

  test('Pulse tab displays architecture map', async ({ page }) => {
    await page.getByRole('tab', { name: /Infra Pulse|结构脉搏/i }).click();
    await expect(
      page.getByText(/Infrastructure Map|基础设施图谱|Live Architecture Feed/i).first()
    ).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByRole('button', { name: /SYNC_TOPOLOGY|同步拓扑/i })).toBeVisible({
      timeout: 20000,
    });
  });

  test('Visual Regression: Infrastructure Map', async ({ page }) => {
    await page.getByRole('tab', { name: /Infra Pulse|结构脉搏/i }).click();
    const map = page.locator('.react-flow');
    await expect(map).toBeVisible();

    // Wait for the neural grid to initialize and stabilize
    await expect(page.getByText(/Initializing_Neural_Grid/i)).not.toBeVisible({ timeout: 15000 });

    // Hide dynamic elements like the Sync button to avoid noise in screenshot
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const syncBtn = btns.find((b) => b.textContent?.includes('SYNC'));
      if (syncBtn) (syncBtn as HTMLElement).style.display = 'none';
    });

    // Capture and compare screenshot
    await expect(map).toHaveScreenshot('infrastructure-map.png', {
      maxDiffPixelRatio: 0.1, // Allow minor rendering variance due to neural animations
    });
  });

  test('Resilience tab displays health metrics', async ({ page }) => {
    await page.getByRole('tab', { name: /Resilience|韧性中心/i }).click();
    await page.waitForTimeout(1000); // Wait for tab transition
    await expect(
      page.getByText(/Stability_Diagnostics|SYSTEM_ADVISORY|HEALTH_SCORE/i).first()
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test('Cognitive tab displays agent health scores', async ({ page }) => {
    await page.getByRole('tab', { name: /Cognitive|认知健康/i }).click();
    await page.waitForTimeout(1000);
    await expect(
      page
        .getByText(
          /Neural_Sync_Status|Objective Alignment|No active cognitive traces|CROSS_AGENT_TRUST/i
        )
        .first()
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test('Traffic tab displays active session locks', async ({ page }) => {
    await page.getByRole('tab', { name: /Traffic|并发流量/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(/Lane Concurrency Monitor/i)).toBeVisible({ timeout: 10000 });
  });

  test('navigation from sidebar to observability works', async ({ page }) => {
    await page.goto('/');
    // Wait for sidebar to be loaded and interactive
    await page.waitForLoadState('networkidle');
    // Add a small delay to ensure sidebar is rendered
    await page.waitForTimeout(500);

    // Try to find the observability link with better error context
    const observabilityLink = page.locator('a[href="/observability"]').first();

    // Check if link exists and is visible
    if (!(await observabilityLink.count())) {
      throw new Error('Observability link (a[href="/observability"]) not found on home page');
    }

    // Wait for link to be visible and clickable
    await observabilityLink.waitFor({ state: 'visible', timeout: 5000 });
    await observabilityLink.click({ timeout: 5000 });

    // Verify navigation succeeded
    await expect(page).toHaveURL(/\/observability/);
  });
});
