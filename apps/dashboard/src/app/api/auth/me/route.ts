import { NextRequest, NextResponse } from 'next/server';
import { getIdentityManager } from '@claw/core/lib/session/identity';
import { AUTH } from '@/lib/constants';
import { HTTP_STATUS } from '@claw/core/lib/constants';
import { logger } from '@claw/core/lib/logger';

/**
 * Returns the current authenticated user's profile.
 */
export async function GET(req: NextRequest) {
  const userId = req.cookies.get(AUTH.SESSION_USER_ID)?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });
  }

  try {
    const manager = await getIdentityManager();
    const user = await manager.getUser(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: HTTP_STATUS.NOT_FOUND });
    }

    // Strip sensitive info
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { hashedPassword, ...safeUser } = user;

    return NextResponse.json({ user: safeUser });
  } catch (error) {
    logger.error('[Auth:Me] Failed to fetch user:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
}
