/**
 * @module AuthAPI
 * Simple password-based authentication for the dashboard using secure HTTP-only cookies.
 */
import { NextRequest, NextResponse } from 'next/server';
import { AUTH } from '@/lib/constants';
import { HTTP_STATUS } from '@claw/core/lib/constants';
import { logger } from '@claw/core/lib/logger';
import { resolveSSTResourceValue } from '@claw/core/lib/utils/resource-helpers';

/**
 * Handles dashboard login and sets the session cookie
 *
 * @param req - The incoming POST request with password in the body.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId, password } = await req.json();
    const isDev = process.env.NODE_ENV !== 'production';

    // Debug SST Resources
    const sstKeys = Object.keys(process.env).filter((k) => k.startsWith('SST_RESOURCE_'));
    logger.info(`[Auth:Login] Available SST Resources: ${sstKeys.join(', ')}`);

    // 1. Check for Legacy/Root Dashboard Password
    let rootPassword = process.env.DASHBOARD_PASSWORD;

    logger.info(
      `[Auth:Login] Checking DASHBOARD_PASSWORD env... Found: ${rootPassword ? 'YES' : 'NO'}`
    );

    if (
      isDev &&
      (!rootPassword || (typeof rootPassword === 'string' && rootPassword.includes('{{')))
    ) {
      rootPassword = 'test-password';
      logger.info('[Auth:Login] Using dev fallback password');
    }

    const isRootAuth =
      (!userId || userId === 'dashboard-user') &&
      password &&
      rootPassword &&
      (password === rootPassword || (isDev && password === 'test-password'));

    let finalUserId = 'dashboard-user';
    let isAuthorized = isRootAuth;

    // 2. Check for Specific User Identity
    if (!isAuthorized && userId && password) {
      try {
        const { getIdentityManager } = await import('@claw/core/lib/session/identity');
        const identityManager = await getIdentityManager();
        isAuthorized = await identityManager.verifyPassword(userId, password);
        if (isAuthorized) {
          finalUserId = userId;
        }
      } catch (idErr) {
        logger.error('[Auth:Login] IdentityManager failure:', idErr);
        // Fallback to false, don't crash the whole route
        isAuthorized = false;
      }
    }

    if (isAuthorized) {
      logger.info(`[Auth:Login] ✅ Authorized successful for ${finalUserId} (isDev=${isDev})`);
      const response = NextResponse.json({ success: true });

      // Register session with IdentityManager
      try {
        const { getIdentityManager, UserRole } = await import('@claw/core/lib/session/identity');
        const identityManager = await getIdentityManager();
        const authResult = await identityManager.authenticate(finalUserId, 'dashboard');

        // Auto-provision dashboard-user as admin if needed
        if (
          finalUserId === 'dashboard-user' &&
          authResult.user?.role !== UserRole.ADMIN &&
          authResult.user?.role !== UserRole.OWNER
        ) {
          await identityManager.updateUserRole(finalUserId, UserRole.ADMIN, 'superadmin');
        }
      } catch (err) {
        logger.error(`[Auth:Login] Failed to register session for ${finalUserId}:`, err);
      }

      response.cookies.set(AUTH.COOKIE_NAME, AUTH.COOKIE_VALUE, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: AUTH.COOKIE_MAX_AGE,
        path: '/',
      });

      response.cookies.set(AUTH.SESSION_USER_ID, finalUserId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: AUTH.COOKIE_MAX_AGE,
        path: '/',
      });

      return response;
    }

    logger.warn(`[Auth:Login] ❌ Unauthorized attempt for user: ${userId || 'root'}`);
    return NextResponse.json(
      { error: AUTH.ERROR_INVALID_CREDENTIALS },
      { status: HTTP_STATUS.UNAUTHORIZED }
    );
  } catch (error) {
    logger.error('Auth Error:', error);
    return NextResponse.json(
      { error: AUTH.ERROR_SYSTEM_FAILURE },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
