import path from 'path';
import fs from 'fs';
import { test as setup, expect } from 'playwright/test';

// Use path resolution to ensure the auth file is saved in the same directory as the setup script
const authFile = path.join(__dirname, '.auth/user.json');
const cwdAuthFile = path.join(process.cwd(), 'e2e/.auth/user.json');

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

/**
 * Attempt login with retry logic to handle cold-starts on deployed environments.
 * Returns the response body or throws on exhaustion.
 */
async function loginWithRetry(
  request: Parameters<Parameters<typeof setup>[1]>[0]['request'],
  password: string,
  userId: string,
  maxAttempts = 3,
  delayMs = 3000
): Promise<{ status: number; body: unknown }> {
  let lastStatus = 0;
  let lastBody: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await request.post('/api/auth/login', {
        timeout: 20000,
        data: { userId, password },
      });
      lastStatus = response.status();
      lastBody = await response.json().catch(() => null);

      console.log(`[E2E:Auth] Attempt ${attempt}/${maxAttempts}: status=${lastStatus}`);

      if (lastStatus === 200) {
        return { status: lastStatus, body: lastBody };
      }
    } catch (err) {
      console.warn(`[E2E:Auth] Attempt ${attempt}/${maxAttempts} failed with error: ${err}`);
      lastBody = { error: String(err) };
    }

    if (attempt < maxAttempts) {
      console.log(`[E2E:Auth] Waiting ${delayMs}ms before retry...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { status: lastStatus, body: lastBody };
}

setup('authenticate', async ({ request, browserName }, _testInfo) => {
  // Get baseURL from environment or use fallback from playwright config
  const baseUrl = process.env.BASE_URL || 'http://localhost:7777';
  const isDeployed = !baseUrl.includes('localhost');
  const domain = extractDomainFromUrl(baseUrl);

  // Password resolution order:
  // 1. DASHBOARD_PASSWORD env var (set by the Makefile for deployed runs from .env.dev/.env.prod)
  // 2. 'claw123' — matches the seed-e2e.ts default for 'dashboard-user' in deployed envs
  // 3. 'test-password' — only works in local dev (NODE_ENV !== 'production' fallback in route.ts)
  const password = process.env.DASHBOARD_PASSWORD || (isDeployed ? 'claw123' : 'test-password');
  const userId = 'dashboard-user'; // Default userId for E2E tests

  console.log(
    `[E2E:Auth] Setup running for browser="${browserName}", domain="${domain}", baseUrl="${baseUrl}", isDeployed=${isDeployed}`
  );
  console.log(
    `[E2E:Auth] Authenticating as userId=${userId}, password source=${process.env.DASHBOARD_PASSWORD ? 'DASHBOARD_PASSWORD env' : isDeployed ? 'claw123 default (deployed)' : 'test-password default (local)'}`
  );

  const { status, body } = await loginWithRetry(request, password, userId);

  if (status !== 200) {
    console.error(`[E2E:Auth] Login failed after all retries. status=${status}`);
    console.error(`[E2E:Auth] Response body: ${JSON.stringify(body)}`);
    console.error(
      `[E2E:Auth] Hint: Ensure seed-e2e ran for this environment and DASHBOARD_PASSWORD matches the seeded password.`
    );
  }

  expect(
    status,
    `Login to ${baseUrl} failed with status ${status}. Body: ${JSON.stringify(body)}`
  ).toBe(200);

  const data = body as { success?: boolean };
  expect(data.success, 'Login response did not include success:true').toBe(true);

  // Save authentication state from the API context
  // The request context automatically includes cookies for the current domain
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await request.storageState({ path: authFile });

  // Some release flows execute Playwright from repository root while specs use
  // `e2e/.auth/user.json` relative to CWD. Persist there too for portability.
  fs.mkdirSync(path.dirname(cwdAuthFile), { recursive: true });
  await request.storageState({ path: cwdAuthFile });

  console.log(`[E2E:Auth] Authentication state saved to ${authFile}`);
  if (cwdAuthFile !== authFile) {
    console.log(`[E2E:Auth] Authentication state also saved to ${cwdAuthFile}`);
  }
  console.log(`[E2E:Auth] Cookies will be applied for domain: ${domain}`);
});
