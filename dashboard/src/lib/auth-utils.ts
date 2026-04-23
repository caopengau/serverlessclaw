import { NextRequest } from 'next/server';
import { AUTH } from '@/lib/constants';

/**
 * Extracts the user ID from the session cookie in a NextRequest.
 * Falls back to 'dashboard-user' if cookies are missing or the session cookie is not present.
 */
export function getUserId(req: NextRequest): string {
  if (!req.cookies) {
    return 'dashboard-user';
  }
  const sessionCookie = req.cookies.get(AUTH.SESSION_USER_ID);
  return sessionCookie?.value || 'dashboard-user';
}
