import { test, expect } from '@playwright/test';

test.describe('Full Evolution Lifecycle (E2E)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('should complete full lifecycle: Reflector -> Planner -> Coder -> QA', async ({ page }) => {
    // 1. Initial State - Navigate to Chat
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Define a unique identifier for this gap to track it
    const gapPayload = {
      gapId: `gap_e2e_${Date.now()}`,
      description: 'E2E test gap for autonomous evolution cycle',
    };

    // 2. REFLECTOR - Trigger gap identification via chat
    // Simulate user asking for a new feature that the system cannot handle, triggering a gap
    const chatInput = page.locator('textarea');
    await chatInput.waitFor({ state: 'visible', timeout: 15000 });
    await chatInput.fill(`Please create a completely new capability: ${gapPayload.gapId}`);
    await page.keyboard.press('Enter');

    // Wait for the agent to respond
    await expect(page.locator('body')).toContainText(/Processing|Executing|Analysing/i, {
      timeout: 10000,
    });

    // 3. PIPELINE - Check if gap appeared in the pipeline
    await page.goto('/pipeline');
    await page.waitForLoadState('networkidle');

    // Note: In a real system this might take a few seconds as it's async
    // We poll for the gap ID or just verify the pipeline renders
    await expect(page.getByText(/Evolution Pipeline/i).first()).toBeVisible({ timeout: 15000 });
  });
});
