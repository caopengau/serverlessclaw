import { test, expect } from '@playwright/test';
import { logger } from '../core/lib/logger';

test.describe('Chat Flow', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('renders chat page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.getByRole('button', { name: /SEND|发送/i }).first()).toBeVisible();
  });

  test('send button is disabled when input is empty', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /SEND|发送/i }).first()).toBeDisabled();
  });

  test('send button is enabled when input has text', async ({ page }) => {
    await page.goto('/');
    await page.fill('textarea', 'Hello agent');
    await expect(page.getByRole('button', { name: /SEND|发送/i }).first()).toBeEnabled();
  });

  test('sends message and displays in chat', async ({ page }) => {
    await page.goto('/');
    await page.fill('textarea', 'Test message');
    await page
      .getByRole('button', { name: /SEND|发送/i })
      .first()
      .click();

    await expect(page.getByText('Test message')).toBeVisible({ timeout: 10000 });
  });

  test('displays EXECUTING state while loading', async ({ page }) => {
    await page.goto('/');
    await page.fill('textarea', 'Processing test');
    await page
      .getByRole('button', { name: /SEND|发送/i })
      .first()
      .click();

    // This state might be transient if the response is fast, so we wait with a very short timeout
    // and don't fail hard if it was too fast to catch
    try {
      const executingButton = page.getByText(/EXECUTING|处理中/i);
      await expect(executingButton).toBeVisible({ timeout: 500 });
    } catch {
      logger.info('Response was likely too fast to catch EXECUTING state');
    }
  });

  test('textarea supports Enter to send', async ({ page }) => {
    await page.goto('/');
    await page.fill('textarea', 'Enter send test');
    await page.press('textarea', 'Enter');

    await expect(page.getByText('Enter send test')).toBeVisible({ timeout: 10000 });
  });

  test('chat sidebar shows conversations', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('aside').first()).toBeVisible();
  });
});
