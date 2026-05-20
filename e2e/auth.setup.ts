import path from 'path';
import { test as setup, expect } from 'playwright/test';

// Use path resolution to ensure the auth file is saved in the same directory as the setup script
const authFile = path.join(__dirname, '.auth/user.json');

/**
 * Extract domain from URL for cookie configuration.
 * Handles different URL formats: http://localhost:7777, https://example.com, etc.
 */
function extractDomainFromUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    // Return domain without port for cookie domain (cookies use domain without port)
    return url.hostname;
  } catch {
    console.warn(`[E2E:Auth] Failed to parse URL "${urlString}", using localhost as fallback`);
    return 'localhost';
  }
}

setup('authenticate', async ({ request, browserName }, _testInfo) => {
  const baseUrl = request.url('').replace(/\/$/, ''); // Get baseURL from request context
  const domain = extractDomainFromUrl(baseUrl);
  const password = process.env.DASHBOARD_PASSWORD || 'test-password';
  const userId = 'dashboard-user'; // Default userId for E2E tests

  console.log(
    `[E2E:Auth] Setup running for browser="${browserName}", domain="${domain}", baseUrl="${baseUrl}"`
  );
  console.log(
    `[E2E:Auth] Authenticating via API with userId=${userId} and password from ${process.env.DASHBOARD_PASSWORD ? 'env' : 'fallback'}`
  );

  const response = await request.post('/api/auth/login', {
    timeout: 15000,
    data: { userId, password },
  });

  if (response.status() !== 200) {
    console.error(`[E2E:Auth] Login failed with status ${response.status()}`);
    console.error(`[E2E:Auth] Response: ${await response.text()}`);
  }

  expect(response.status()).toBe(200);

  const data = await response.json();
  expect(data.success).toBe(true);

  // Save authentication state from the API context
  // The request context automatically includes cookies for the current domain
  await request.storageState({ path: authFile });
  console.log(`[E2E:Auth] Authentication state saved to ${authFile}`);
  console.log(`[E2E:Auth] Cookies will be applied for domain: ${domain}`);
});
