import path from 'path';
import { test as setup, expect } from 'playwright/test';

// Use path resolution to ensure the auth file is saved in the same directory as the setup script
const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ request }) => {
  const password = process.env.DASHBOARD_PASSWORD || 'test-password';
  const userId = 'dashboard-user'; // Default userId for E2E tests
  console.log(
    `[E2E:Auth] Authenticating via API with userId=${userId} and password from ${process.env.DASHBOARD_PASSWORD ? 'env' : 'fallback'}`
  );

  const response = await request.post('/api/auth/login', {
    timeout: 15000,
    data: { userId, password },
  });

  expect(response.status()).toBe(200);

  const data = await response.json();
  expect(data.success).toBe(true);

  // Save authentication state from the API context
  await request.storageState({ path: authFile });
  console.log('[E2E:Auth] Authentication state saved successfully via API');
});
