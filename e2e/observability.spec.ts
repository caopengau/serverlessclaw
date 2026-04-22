import { test, expect } from '@playwright/test';

test.describe('Nerve Center (Unified Observability)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/observability');
    // Ensure the hub is loaded
    await expect(page.getByText(/Nerve Center Hub/i)).toBeVisible({ timeout: 15000 });
  });

  test('renders nerve center with tabbed interface', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /Infra Pulse|结构脉搏/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Resilience|韧性中心/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Cognitive|认知健康/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Traffic|并发流量/i })).toBeVisible();
  });

  test('Pulse tab displays architecture map', async ({ page }) => {
    await page.getByRole('tab', { name: /Infra Pulse|结构脉搏/i }).click();
    // React Flow container check
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 20000 });
  });

  test('Resilience tab displays health metrics', async ({ page }) => {
    await page.getByRole('tab', { name: /Resilience|韧性中心/i }).click();
    await page.waitForTimeout(1000); // Wait for tab transition
    await expect(page.getByText(/System_Stability/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Burn Rate/i)).toBeVisible();
  });

  test('Cognitive tab displays agent health scores', async ({ page }) => {
    await page.getByRole('tab', { name: /Cognitive|认知健康/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(/Deep Cognitive Health/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Cross-Agent Trust/i)).toBeVisible();
  });

  test('Traffic tab displays active session locks', async ({ page }) => {
    await page.getByRole('tab', { name: /Traffic|并发流量/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(/Lane Concurrency Monitor/i)).toBeVisible({ timeout: 10000 });
  });

  test('navigation from sidebar to observability works', async ({ page }) => {
    await page.goto('/');
    // Use the side navigation
    await page.getByRole('link', { name: /Observability|神经中枢/i }).click();
    await expect(page).toHaveURL(/\/observability/);
  });
});
