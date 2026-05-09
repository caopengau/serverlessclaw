import { test, expect } from '@playwright/test';

test.describe('Mission Dashboard', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('renders mission dashboard landing page', async ({ page }) => {
    await page.goto('/');

    // Check for the high-level sector titles
    await expect(page.getByText(/Recent_Missions/i)).toBeVisible();
    await expect(page.getByText(/Nerve_Center_Summary/i)).toBeVisible();
    await expect(page.getByText(/Operator_Quick_Actions/i)).toBeVisible();
  });

  test('displays system stability status', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/System_Stability/i)).toBeVisible();
    await expect(page.getByText(/NOMINAL/i)).toBeVisible();
  });

  test('quick actions are available', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Sync_Agents/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Safety_Scan/i })).toBeVisible();
  });

  test('can navigate to Intelligence Sector from Dashboard', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Intelligence Sector/i }).click();
    await expect(page).toHaveURL(/\/chat/);
  });

  test('can navigate to Nerve Center from Dashboard', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Inspect Nerve Center/i }).click();
    await expect(page).toHaveURL(/\/observability/);
  });
});
