import path from 'path';
import { test, expect } from 'playwright/test';

test.describe('Traces', () => {
  test.use({ storageState: path.join(__dirname, '.auth/user.json') });

  test('renders traces page', async ({ page }) => {
    await page.goto('/trace');
    await expect(page).toHaveURL('/trace');
  });

  test('displays trace list', async ({ page }) => {
    await page.goto('/trace');
    await page.waitForLoadState('networkidle');
    // Should load without critical errors
    await expect(page.locator('body')).not.toContainText('Error');
    await expect(page.getByText(/Trace Intelligence|追踪情报/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('can click a trace to see details', async ({ page }) => {
    await page.goto('/trace');
    await page.waitForLoadState('networkidle');

    const traceLinks = page.locator('a[href*="/trace/"]');
    const traceCount = await traceLinks.count();

    if (traceCount === 0) {
      await expect(
        page.getByText(/NO_TRACES_FOUND|未找到链路|No active mission logs detected/i)
      ).toBeVisible({
        timeout: 15000,
      });
      return;
    }

    await traceLinks.first().click();
    // Should navigate to trace detail or show detail view
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('trace-detail-container')).toBeVisible({ timeout: 20000 });
  });

  test('navigation from sidebar to traces works', async ({ page }) => {
    await page.goto('/');
    // Wait for sidebar to be loaded and interactive
    await page.waitForLoadState('networkidle');
    // Add a small delay to ensure sidebar is rendered
    await page.waitForTimeout(500);

    // Try to find the trace link with better error context
    const traceLink = page.locator('a[href="/trace"]').first();

    // Check if link exists and is visible
    if (!(await traceLink.count())) {
      throw new Error('Trace link (a[href="/trace"]) not found on home page');
    }

    // Wait for link to be visible and clickable
    await traceLink.waitFor({ state: 'visible', timeout: 5000 });
    await traceLink.click({ timeout: 5000 });

    // Verify navigation succeeded
    await expect(page).toHaveURL('/trace');
  });
});
