import { test, expect } from '@playwright/test';

test.describe('Agent Collaboration & Swarm Intelligence', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('renders collaboration canvas on trace detail page', async ({ page }) => {
    // Navigate to a trace that we expect to have collaboration data
    // For E2E, we'll try to find any trace and then look for the canvas
    await page.goto('/trace');
    await page.waitForLoadState('networkidle');

    const traceLink = page.locator('text=/Collaboration Test Trace/i').first();
    await expect(traceLink).toBeVisible({ timeout: 15000 });
    await traceLink.click();
    await page.waitForLoadState('networkidle');

    // CollaborationCanvas should exist in the DOM
    const canvas = page.getByTestId('collaboration-canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 20000 });
  });

  test('displays swarm consensus view when available', async ({ page }) => {
    await page.goto('/pipeline');
    await page.waitForLoadState('networkidle');

    // Click on the specific seeded gap
    const gapItem = page.locator('text=/Simulated capability failure/i').first();
    await expect(gapItem).toBeVisible({ timeout: 15000 });
    await gapItem.click();
    await page.waitForLoadState('networkidle');

    // Look for SwarmConsensusView components
    const consensusView = page.locator('text=/Consensus|Swarm|Agreement/i').first();
    await expect(consensusView).toBeVisible({ timeout: 10000 });
  });

  test('verifies path visualization for complex tasks', async ({ page }) => {
    await page.goto('/trace');
    await page.waitForLoadState('networkidle');

    // Check if PathVisualizer component is present
    const visualizer = page.getByTestId('collaboration-canvas');
    // Verify visualizer renders
    await expect(visualizer.first()).toBeVisible({ timeout: 15000 });
  });
});
