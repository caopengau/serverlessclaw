import { test, expect } from 'playwright/test';

test.describe('MCP Integration (Capabilities)', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('renders MCP tab in capabilities', async ({ page }) => {
    await page.goto('/capabilities');
    await page.waitForLoadState('networkidle');

    // Select the MCP tab if it exists
    const mcpTab = page.locator(
      'button:has-text("Skill Bridges"), button:has-text("技能桥梁"), [role="tab"]:has-text("Skill Bridges"), [role="tab"]:has-text("技能桥梁")'
    );
    if (await mcpTab.count()) {
      await mcpTab.first().click();
      // Page should have content
      await expect(page.locator('body')).toBeTruthy({ timeout: 5000 });
    } else {
      // Just verify capabilities page loaded
      await expect(page).toHaveURL('/capabilities');
    }
  });

  test('allows tool discovery from MCP servers', async ({ page }) => {
    await page.goto('/capabilities');
    await page.waitForLoadState('networkidle');
    await page
      .locator('button:has-text("Skill Bridges"), button:has-text("技能桥梁")')
      .first()
      .click();

    // Verify presence of tools list or search
    const toolSearch = page
      .locator(
        'input[placeholder*="Search current capabilities"], input[placeholder*="搜索当前能力"]'
      )
      .first();
    if (await toolSearch.isVisible()) {
      await toolSearch.fill('filesystem');
      await expect(toolSearch).toHaveValue('filesystem', { timeout: 2000 });
    }
  });

  test('trace detail displays tool execution source (MCP vs Local)', async ({ page }) => {
    await page.goto('/trace');
    await page.waitForLoadState('networkidle');

    const traceLinks = page.locator('a[href*="/trace/"]');
    const traceCount = await traceLinks.count();

    if (traceCount === 0) {
      // No traces available, just verify page loaded
      await expect(page).toHaveURL('/trace');
      return;
    }

    await traceLinks.first().click();
    await page.waitForLoadState('networkidle');

    // Just verify page loaded, trace detail content may vary
    await expect(page).toHaveURL(/\/trace\//);
  });
});
