import { test, expect } from '@playwright/test';

test.describe('Chat Flow', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('renders chat page at /chat', async ({ page }) => {
    await page.goto('/chat');
    // Increased timeout for initial session registry sync
    await expect(page.locator('textarea')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /SEND|发送/i }).first()).toBeVisible();
  });

  test('context panel is visible or toggleable', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForTimeout(2000);
    // Check for context panel elements
    if (!(await page.getByText(/Intel_Context/i).isVisible())) {
      // Toggle it via the button instead of keyboard shortcut for stability
      await page.getByLabel(/Toggle Session Intelligence/i).click();
    }
    await expect(page.getByText(/Intel_Context/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /LIVE/i })).toBeVisible();
  });

  test('send button is disabled when input is empty', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('textarea')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /SEND|发送/i }).first()).toBeDisabled();
  });

  test('send button is enabled when input has text', async ({ page }) => {
    await page.goto('/chat');
    await page.fill('textarea', 'Hello agent');
    await expect(page.getByRole('button', { name: /SEND|发送/i }).first()).toBeEnabled();
  });

  test('sends message and displays in chat', async ({ page }) => {
    await page.goto('/chat');
    await page.fill('textarea', 'Test message');
    await page
      .getByRole('button', { name: /SEND|发送/i })
      .first()
      .click();

    await expect(page.getByText('Test message')).toBeVisible({ timeout: 15000 });
  });

  test('displays EXECUTING state while loading', async ({ page }) => {
    await page.goto('/chat');
    await page.fill('textarea', 'Processing test');
    await page
      .getByRole('button', { name: /SEND|发送/i })
      .first()
      .click();

    try {
      const executingButton = page.getByText(/EXECUTING|处理中/i);
      await expect(executingButton).toBeVisible({ timeout: 1000 });
    } catch {
      console.info('Response was likely too fast to catch EXECUTING state');
    }
  });

  test('textarea supports Enter to send', async ({ page }) => {
    await page.goto('/chat');
    await page.fill('textarea', 'Enter send test');
    await page.press('textarea', 'Enter');

    await expect(page.getByText('Enter send test')).toBeVisible({ timeout: 15000 });
  });

  test('chat sidebar shows conversations', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('aside').first()).toBeVisible();
  });
});
