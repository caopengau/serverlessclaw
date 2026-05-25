import path from 'path';
import { test } from 'playwright/test';

test.describe('Trace Page Diagnostics', () => {
  test.use({ storageState: path.join(__dirname, '.auth/user.json') });

  test('queries traces and logs results', async ({ page }) => {
    // Listen to console logs
    page.on('console', (msg) => {
      console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
    });

    // Listen to page errors
    page.on('pageerror', (err) => {
      console.error(`[BROWSER ERROR] ${err.message}`);
    });

    console.log('Navigating to /trace...');
    await page.goto('/trace');

    // Wait for the page to load
    await page.waitForTimeout(5000);

    // Let's take a screenshot to visually verify!
    await page.screenshot({ path: 'e2e/trace-screenshot.png' });
    console.log('Screenshot saved to e2e/trace-screenshot.png');

    // Let's get all trace elements rendered on the page
    const traceRowTexts = await page.evaluate(() => {
      // Find all elements containing trace items
      const elements = Array.from(
        document.querySelectorAll('tr, .trace-card, .glass-card, a[href*="/trace/"], [role="row"]')
      );
      return elements.map((el) => el.textContent?.trim());
    });
    console.log('Found trace row elements on page:', traceRowTexts);
  });
});
